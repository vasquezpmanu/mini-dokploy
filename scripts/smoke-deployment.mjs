import assert from "node:assert/strict";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import WebSocket from "ws";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function user(name) {
  const email = `smoke-${name}-${Date.now()}@example.test`;
  const response = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ name, email, password: "LocalTestPassword123!" }),
  });
  assert.equal(response.status, 200, `sign up failed: ${await response.text()}`);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  return {
    cookie,
    client: createTRPCClient({
      links: [httpBatchLink({ url: `${base}/api/trpc`, headers: { cookie } })],
    }),
  };
}

async function waitFor(client, id, revision) {
  const deadline = Date.now() + 300_000;
  let lastStatus = "";
  while (Date.now() < deadline) {
    const item = (await client.deployments.list.query()).find((row) => row.id === id);
    assert.ok(item, "deployment disappeared");
    if (item.status !== lastStatus) {
      console.log(`Deployment status: ${item.status}`);
      lastStatus = item.status;
    }
    if (item.status === "failed") throw new Error(item.lastError ?? "deployment failed");
    if (item.status === "running" && item.revision >= revision) return item;
    await sleep(2000);
  }
  throw new Error("deployment did not become ready within five minutes");
}

async function waitForRoute(domain) {
  const deadline = Date.now() + 45_000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const response = await fetch(`http://${domain}`);
    lastStatus = response.status;
    if (response.status === 200) return response;
    await sleep(1000);
  }
  throw new Error(`Traefik route did not become ready; last HTTP status was ${lastStatus}`);
}

const owner = await user("owner");
let created;
let socket;
let sawLogs = false;
let logText = "";
try {
  created = await owner.client.deployments.create.mutate({
    repoUrl: "https://github.com/docker/welcome-to-docker.git",
    dockerfilePath: "Dockerfile",
    port: 3000,
    customLabels: { "test.case": "smoke" },
  });
  console.log(`Created ${created.serviceName}`);

  socket = new WebSocket(`${base.replace(/^http/, "ws")}/api/logs?id=${created.id}`, {
    headers: { Cookie: owner.cookie, Origin: base },
  });
  socket.on("message", (data) => {
    const chunk = data.toString();
    if (chunk.length > 0) sawLogs = true;
    logText = (logText + chunk).slice(-8192);
  });
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });

  const other = await user("other");
  assert.ok(!(await other.client.deployments.list.query()).some((row) => row.id === created.id));
  await assert.rejects(
    () => other.client.deployments.redeploy.mutate({ id: created.id }),
    (error) => error?.data?.code === "NOT_FOUND",
  );
  const deniedSocket = new WebSocket(`${base.replace(/^http/, "ws")}/api/logs?id=${created.id}`, {
    headers: { Cookie: other.cookie, Origin: base },
  });
  const deniedStatus = await new Promise((resolve) => {
    deniedSocket.once("unexpected-response", (_request, response) => resolve(response.statusCode));
    deniedSocket.once("open", () => resolve(101));
    deniedSocket.once("error", () => {});
  });
  assert.equal(deniedStatus, 403, "another tenant must not read the logs");
  deniedSocket.terminate();

  const running = await waitFor(owner.client, created.id, 1);
  const appResponse = await waitForRoute(running.domain);
  assert.ok((await appResponse.text()).length > 0);
  assert.ok(sawLogs, "WebSocket did not deliver build logs");

  await owner.client.deployments.redeploy.mutate({ id: created.id });
  await waitFor(owner.client, created.id, 2);
  console.log("Deployment smoke test passed: route, ownership, logs, and redeploy.");
} catch (error) {
  console.error(`Recent deployment logs:\n${logText.slice(-3000)}`);
  throw error;
} finally {
  socket?.close();
  if (created) {
    try {
      await owner.client.deployments.remove.mutate({ id: created.id });
      console.log("Removed test service.");
    } catch (error) {
      console.error(`Could not remove test service: ${error.message}`);
    }
  }
}
