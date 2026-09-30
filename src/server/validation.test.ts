import { describe, expect, it } from "vitest";
import { createDeploymentInput, routingLabels } from "./validation";

const valid = {
  repoUrl: "https://github.com/example/app.git",
  dockerfilePath: "docker/Dockerfile",
  port: 3000,
  customLabels: { team: "demo" },
};

describe("deployment input", () => {
  it("accepts a public HTTPS repository and a nested Dockerfile", () => {
    expect(createDeploymentInput.parse(valid)).toEqual(valid);
  });

  it.each([
    { repoUrl: "file:///tmp/app" },
    { repoUrl: "https://user:secret@example.com/app.git" },
    { dockerfilePath: "../Dockerfile" },
    { dockerfilePath: "/etc/passwd" },
    { port: 0 },
    { port: 65536 },
    { customLabels: { "traefik.http.routers.other.rule": "Host(`x`)" } },
    { customLabels: { team: "two\nlines" } },
    {
      customLabels: Object.fromEntries(
        Array.from({ length: 21 }, (_, index) => [`key${index}`, "value"]),
      ),
    },
  ])("rejects unsafe or unusable input: %j", (change) => {
    expect(createDeploymentInput.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe("routing labels", () => {
  it("connects one generated host and internal port without losing ordinary custom labels", () => {
    const labels = routingLabels("abc123", "app-abc123.127.0.0.1.sslip.io", 8080, { team: "demo" });
    expect(labels.team).toBe("demo");
    expect(labels["traefik.http.routers.app-abc123.rule"]).toBe(
      "Host(`app-abc123.127.0.0.1.sslip.io`)",
    );
    expect(labels["traefik.http.services.app-abc123.loadbalancer.server.port"]).toBe("8080");
  });
});
