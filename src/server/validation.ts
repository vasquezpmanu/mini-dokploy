import path from "node:path";
import { z } from "zod";

const labelsSchema = z
  .record(z.string(), z.string())
  .default({})
  .superRefine((labels, ctx) => {
    if (Object.keys(labels).length > 20) {
      ctx.addIssue({ code: "custom", message: "Use at most 20 labels." });
    }
    for (const [key, value] of Object.entries(labels)) {
      if (
        !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(key) ||
        key.startsWith("traefik.") ||
        key.startsWith("mini-dokploy.")
      ) {
        ctx.addIssue({ code: "custom", message: `Invalid or reserved label: ${key}` });
      }
      if (value.length > 1024 || /[\r\n]/.test(value)) {
        ctx.addIssue({ code: "custom", message: `Invalid label value: ${key}` });
      }
    }
  });

export const createDeploymentInput = z.object({
  repoUrl: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Use a public HTTPS Git URL without credentials."),
  dockerfilePath: z
    .string()
    .min(1)
    .max(256)
    .refine((value) => {
      return (
        !path.posix.isAbsolute(value) &&
        !value.includes("\\") &&
        value.split("/").every((part) => part !== ".." && part !== "") &&
        !value.startsWith("-")
      );
    }, "Use a Dockerfile path relative to the repository root."),
  port: z.number().int().min(1).max(65535),
  customLabels: labelsSchema,
});

export type CreateDeploymentInput = z.infer<typeof createDeploymentInput>;

export function routingLabels(
  id: string,
  domain: string,
  port: number,
  customLabels: Record<string, string>,
): Record<string, string> {
  return {
    ...customLabels,
    "mini-dokploy.deployment-id": id,
    "traefik.enable": "true",
    [`traefik.http.routers.app-${id}.rule`]: `Host(\`${domain}\`)`,
    [`traefik.http.routers.app-${id}.entrypoints`]: "web",
    [`traefik.http.routers.app-${id}.service`]: `app-${id}`,
    [`traefik.http.services.app-${id}.loadbalancer.server.port`]: String(port),
  };
}
