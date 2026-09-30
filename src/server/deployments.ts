import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/src/db";
import { deployments, type Deployment } from "@/src/db/schema";
import { routingLabels, type CreateDeploymentInput } from "./validation";
import {
  buildImageArgs,
  createServiceArgs,
  readServiceReplicas,
  updateServiceArgs,
} from "./docker-commands";
import { runDeployment } from "./deployment-flow";
import { resolveDockerfile } from "./repository";

const network = process.env.DOKPLOY_NETWORK ?? "mini-dokploy-public";
const logsDir = process.env.LOGS_DIR ?? "./data/logs";
fs.mkdirSync(logsDir, { recursive: true });

export function logPath(id: string): string {
  if (!/^[a-f0-9]{12}$/.test(id)) throw new Error("Invalid deployment ID");
  return path.join(logsDir, `${id}.log`);
}

function log(id: string, message: string): void {
  fs.appendFileSync(logPath(id), message.endsWith("\n") ? message : `${message}\n`);
}

async function command(
  id: string,
  executable: string,
  args: string[],
  options: { cwd?: string; timeoutMs?: number; quiet?: boolean } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let errorOutput = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeoutMs ?? 600_000);
    child.stdout.on("data", (chunk: Buffer) => {
      const value = chunk.toString();
      output = (output + value).slice(-8192);
      if (!options.quiet) log(id, value);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const value = chunk.toString();
      errorOutput = (errorOutput + value).slice(-8192);
      if (!options.quiet) log(id, value);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(output.trim());
      else
        reject(
          new Error(
            `${executable} exited with code ${code ?? "unknown"}: ${(errorOutput || output).trim().slice(-1000)}`,
          ),
        );
    });
  });
}

function update(id: string, values: Partial<typeof deployments.$inferInsert>): void {
  db.update(deployments)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(deployments.id, id))
    .run();
}

async function serviceExists(id: string, name: string): Promise<boolean> {
  try {
    await command(id, "docker", ["service", "inspect", name], { timeoutMs: 20_000, quiet: true });
    return true;
  } catch {
    return false;
  }
}

async function waitForService(id: string, name: string): Promise<void> {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const services = await command(
      id,
      "docker",
      ["service", "ls", "--filter", `name=${name}`, "--format", "{{.Name}} {{.Replicas}}"],
      { timeoutMs: 20_000, quiet: true },
    );
    if (readServiceReplicas(services, name) === "1/1") return;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  await command(id, "docker", ["service", "ps", "--no-trunc", name], { timeoutMs: 20_000 });
  throw new Error("Service did not reach 1/1 replicas within 90 seconds.");
}

export function createDeployment(ownerId: string, input: CreateDeploymentInput): Deployment {
  const id = randomUUID().replaceAll("-", "").slice(0, 12);
  const now = new Date();
  const deployment: typeof deployments.$inferInsert = {
    id,
    ownerId,
    repoUrl: input.repoUrl,
    dockerfilePath: input.dockerfilePath,
    port: input.port,
    customLabels: input.customLabels,
    serviceName: `mini-dokploy-app-${id}`,
    domain: `app-${id}.127.0.0.1.sslip.io`,
    status: "queued",
    revision: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(deployments).values(deployment).run();
  log(id, `[${now.toISOString()}] Deployment queued.`);
  void deploy(id);
  return db.select().from(deployments).where(eq(deployments.id, id)).get()!;
}

export function redeployDeployment(deployment: Deployment): void {
  if (["queued", "cloning", "building", "deploying"].includes(deployment.status))
    throw new Error("Deployment is already in progress.");
  update(deployment.id, { status: "queued", lastError: null });
  log(deployment.id, `\n[${new Date().toISOString()}] Redeploy queued.`);
  void deploy(deployment.id);
}

async function deploy(id: string): Promise<void> {
  const deployment = db.select().from(deployments).where(eq(deployments.id, id)).get();
  if (!deployment) return;
  await runDeployment(deployment, {
    makeTemp: () => fs.mkdtempSync(path.join(os.tmpdir(), "mini-dokploy-")),
    cleanup: (temp) => fs.rmSync(temp, { recursive: true, force: true }),
    clone: async (url, repo) => {
      await command(id, "git", ["clone", "--depth", "1", url, repo], { timeoutMs: 120_000 });
    },
    resolveDockerfile,
    build: async (dockerfile, image, repo) => {
      await command(id, "docker", buildImageArgs(dockerfile, image, repo), { timeoutMs: 600_000 });
    },
    serviceExists: (name) => serviceExists(id, name),
    createService: async (row, image) => {
      const labels = routingLabels(id, row.domain, row.port, row.customLabels);
      await command(id, "docker", createServiceArgs(row.serviceName, image, network, labels), {
        timeoutMs: 30_000,
      });
    },
    updateService: async (row, image) => {
      await command(id, "docker", updateServiceArgs(row.serviceName, image), { timeoutMs: 30_000 });
    },
    waitForService: (name) => waitForService(id, name),
    save: (change) => update(id, change),
    log: (message) => log(id, message),
  });
}

export async function removeDeployment(deployment: Deployment): Promise<void> {
  if (["queued", "cloning", "building", "deploying"].includes(deployment.status))
    throw new Error("Wait for the current operation to finish.");
  if (await serviceExists(deployment.id, deployment.serviceName)) {
    await command(deployment.id, "docker", ["service", "rm", deployment.serviceName], {
      timeoutMs: 30_000,
    });
  }
  db.delete(deployments)
    .where(and(eq(deployments.id, deployment.id), eq(deployments.ownerId, deployment.ownerId)))
    .run();
  fs.rmSync(logPath(deployment.id), { force: true });
}

export function reconcileInterruptedDeployments(): void {
  for (const row of db.select().from(deployments).all()) {
    if (["queued", "cloning", "building", "deploying"].includes(row.status)) {
      update(row.id, {
        status: row.activeImage ? "running" : "failed",
        lastError: "Controller restarted during deployment.",
      });
      log(row.id, "Controller restarted during deployment.");
    }
  }
}
