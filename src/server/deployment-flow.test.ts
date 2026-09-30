import { describe, expect, it, vi } from "vitest";
import type { Deployment } from "@/src/db/schema";
import { runDeployment, type DeploymentFlowDependencies } from "./deployment-flow";

function fixture(overrides: Partial<Deployment> = {}) {
  const deployment = {
    id: "abc123abc123",
    ownerId: "user-1",
    repoUrl: "https://github.com/example/app.git",
    dockerfilePath: "Dockerfile",
    port: 3000,
    customLabels: {},
    serviceName: "mini-dokploy-app-abc123abc123",
    domain: "app-abc123abc123.127.0.0.1.sslip.io",
    status: "queued",
    revision: 0,
    activeImage: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Deployment;
  const events: string[] = [];
  const dependencies: DeploymentFlowDependencies = {
    makeTemp: vi.fn(() => "/tmp/test-deployment"),
    cleanup: vi.fn(() => events.push("cleanup")),
    clone: vi.fn(async () => {
      events.push("clone");
    }),
    resolveDockerfile: vi.fn(() => "/tmp/test-deployment/repo/Dockerfile"),
    build: vi.fn(async () => {
      events.push("build");
    }),
    serviceExists: vi.fn(async () => false),
    createService: vi.fn(async () => {
      events.push("create");
    }),
    updateService: vi.fn(async () => {
      events.push("update");
    }),
    waitForService: vi.fn(async () => {
      events.push("ready");
    }),
    save: vi.fn((change) => {
      events.push(`status:${change.status}`);
    }),
    log: vi.fn(),
  };
  return { deployment, dependencies, events };
}

describe("deployment flow", () => {
  it("clones, builds, creates and waits before marking an initial deployment running", async () => {
    const { deployment, dependencies, events } = fixture();
    await runDeployment(deployment, dependencies);
    expect(events).toEqual([
      "status:cloning",
      "clone",
      "status:building",
      "build",
      "status:deploying",
      "create",
      "ready",
      "status:running",
      "cleanup",
    ]);
    expect(dependencies.save).toHaveBeenLastCalledWith({
      status: "running",
      revision: 1,
      activeImage: "mini-dokploy-app-abc123abc123:r1",
      lastError: null,
    });
  });

  it("updates an existing service with a new image revision", async () => {
    const { deployment, dependencies, events } = fixture({ revision: 1, activeImage: "old:r1" });
    vi.mocked(dependencies.serviceExists).mockResolvedValue(true);
    await runDeployment(deployment, dependencies);
    expect(events).toContain("update");
    expect(events).not.toContain("create");
    expect(dependencies.updateService).toHaveBeenCalledWith(
      deployment,
      "mini-dokploy-app-abc123abc123:r2",
    );
  });

  it("marks a failed first build and always removes the temporary clone", async () => {
    const { deployment, dependencies } = fixture();
    vi.mocked(dependencies.build).mockRejectedValue(new Error("Dockerfile build failed"));
    await runDeployment(deployment, dependencies);
    expect(dependencies.createService).not.toHaveBeenCalled();
    expect(dependencies.save).toHaveBeenLastCalledWith({
      status: "failed",
      lastError: "Dockerfile build failed",
    });
    expect(dependencies.cleanup).toHaveBeenCalledWith("/tmp/test-deployment");
  });

  it("keeps the previous revision running if redeploy fails before service update", async () => {
    const { deployment, dependencies } = fixture({ revision: 3, activeImage: "old:r3" });
    vi.mocked(dependencies.clone).mockRejectedValue(new Error("Git unavailable"));
    await runDeployment(deployment, dependencies);
    expect(dependencies.build).not.toHaveBeenCalled();
    expect(dependencies.save).toHaveBeenLastCalledWith({
      status: "running",
      lastError: "Git unavailable",
    });
  });

  it("does not build when the Dockerfile resolves outside the repository", async () => {
    const { deployment, dependencies } = fixture();
    vi.mocked(dependencies.resolveDockerfile).mockImplementation(() => {
      throw new Error("Dockerfile outside repository");
    });
    await runDeployment(deployment, dependencies);
    expect(dependencies.build).not.toHaveBeenCalled();
    expect(dependencies.save).toHaveBeenLastCalledWith({
      status: "failed",
      lastError: "Dockerfile outside repository",
    });
  });

  it("does not report success when the service never reaches one replica", async () => {
    const { deployment, dependencies } = fixture();
    vi.mocked(dependencies.waitForService).mockRejectedValue(new Error("Service not ready"));
    await runDeployment(deployment, dependencies);
    expect(dependencies.save).toHaveBeenLastCalledWith({
      status: "failed",
      lastError: "Service not ready",
    });
  });

  it("records an unexpected non-Error rejection as text", async () => {
    const { deployment, dependencies } = fixture();
    vi.mocked(dependencies.clone).mockRejectedValue("Git process stopped");
    await runDeployment(deployment, dependencies);
    expect(dependencies.save).toHaveBeenLastCalledWith({
      status: "failed",
      lastError: "Git process stopped",
    });
  });
});
