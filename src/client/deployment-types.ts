import type { api } from "./api";

export type Deployment = Awaited<ReturnType<typeof api.deployments.list.query>>[number];
export type DeploymentAction = "redeploy" | "remove";
