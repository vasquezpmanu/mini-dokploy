import { describe, expect, it } from "vitest";
import {
  buildImageArgs,
  createServiceArgs,
  readServiceReplicas,
  updateServiceArgs,
} from "../docker-commands";

describe("Docker command construction", () => {
  it("loads a BuildKit image into the local engine so a single-node Swarm can use it", () => {
    expect(buildImageArgs("/tmp/repo/Dockerfile", "app:test", "/tmp/repo")).toEqual([
      "buildx",
      "build",
      "--load",
      "--progress=plain",
      "--file",
      "/tmp/repo/Dockerfile",
      "--tag",
      "app:test",
      "/tmp/repo",
    ]);
  });

  it("creates a service with Swarm labels and the shared overlay network", () => {
    const args = createServiceArgs("app-name", "app:r1", "mini-dokploy-public", {
      "traefik.enable": "true",
      team: "demo",
    });
    expect(args.slice(0, 2)).toEqual(["service", "create"]);
    expect(args).toContain("mini-dokploy-public");
    expect(args).toContain("traefik.enable=true");
    expect(args).toContain("team=demo");
    expect(args.at(-1)).toBe("app:r1");
  });

  it("updates the image with rollback on failure", () => {
    const args = updateServiceArgs("app-name", "app:r2");
    expect(args).toContain("--update-failure-action=rollback");
    expect(args).toContain("--no-resolve-image");
    expect(args.slice(-2)).toEqual(["app:r2", "app-name"]);
  });

  it("reads the exact service even when another name shares its prefix", () => {
    const output = "mini-dokploy-app 1/1\nmini-dokploy-app-abc123 0/1\n";
    expect(readServiceReplicas(output, "mini-dokploy-app")).toBe("1/1");
    expect(readServiceReplicas(output, "mini-dokploy-app-abc123")).toBe("0/1");
    expect(readServiceReplicas(output, "missing")).toBeNull();
  });
});
