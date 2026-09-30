import path from "node:path";
import type { Deployment } from "@/src/db/schema";

export interface DeploymentFlowDependencies {
  makeTemp(): string;
  cleanup(temp: string): void;
  clone(url: string, destination: string): Promise<void>;
  resolveDockerfile(repo: string, dockerfilePath: string): string;
  build(dockerfile: string, image: string, repo: string): Promise<void>;
  serviceExists(name: string): Promise<boolean>;
  createService(deployment: Deployment, image: string): Promise<void>;
  updateService(deployment: Deployment, image: string): Promise<void>;
  waitForService(name: string): Promise<void>;
  save(change: Partial<Deployment>): void;
  log(message: string): void;
}

export async function runDeployment(
  deployment: Deployment,
  dependencies: DeploymentFlowDependencies,
): Promise<void> {
  let temp: string | undefined;
  try {
    dependencies.save({ status: "cloning" });
    temp = dependencies.makeTemp();
    const repo = path.join(temp, "repo");
    await dependencies.clone(deployment.repoUrl, repo);
    const dockerfile = dependencies.resolveDockerfile(repo, deployment.dockerfilePath);

    dependencies.save({ status: "building" });
    const revision = deployment.revision + 1;
    const image = `${deployment.serviceName}:r${revision}`;
    await dependencies.build(dockerfile, image, repo);

    dependencies.save({ status: "deploying" });
    if (await dependencies.serviceExists(deployment.serviceName)) {
      await dependencies.updateService(deployment, image);
    } else {
      await dependencies.createService(deployment, image);
    }
    await dependencies.waitForService(deployment.serviceName);
    dependencies.save({ status: "running", revision, activeImage: image, lastError: null });
    dependencies.log(`Ready: http://${deployment.domain}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    dependencies.log(`ERROR: ${message}`);
    dependencies.save({
      status: deployment.activeImage ? "running" : "failed",
      lastError: message,
    });
  } finally {
    if (temp) dependencies.cleanup(temp);
  }
}
