import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectDir = fileURLToPath(new URL("../../..", import.meta.url));
const script = path.join(projectDir, "scripts/up.sh");

const dockerReady = `case "$*" in
  "context show") printf 'desktop-linux\\n' ;;
  "info --format {{.Swarm.LocalNodeState}}") printf 'active\\n' ;;
  *) exit 0 ;;
esac`;

function runScript(
  options: {
    missing?: string;
    platform?: string;
    docker?: string;
    open?: string;
  } = {},
) {
  const fakePath = mkdtempSync(path.join(os.tmpdir(), "mini-dokploy-up-test-"));
  const commands: Record<string, string> = {
    uname: `printf '%s\\n' '${options.platform ?? "Darwin"}'`,
    dirname: "printf 'scripts\\n'",
    docker: options.docker ?? dockerReady,
    curl: "exit 0",
    openssl: "exit 0",
    open: options.open ?? "exit 0",
  };
  try {
    for (const [name, body] of Object.entries(commands)) {
      if (name === options.missing) continue;
      const commandPath = path.join(fakePath, name);
      writeFileSync(commandPath, `#!/bin/sh\n${body}\n`);
      chmodSync(commandPath, 0o755);
    }
    return spawnSync("/bin/sh", [script], {
      cwd: projectDir,
      env: { ...process.env, PATH: fakePath },
      encoding: "utf8",
      timeout: 3_000,
    });
  } finally {
    rmSync(fakePath, { recursive: true, force: true });
  }
}

describe("local startup preflight", () => {
  it("rejects non-macOS before touching Docker", () => {
    const result = runScript({ platform: "Linux", docker: "echo DOCKER_CALLED >&2" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("macOS");
    expect(result.stderr).not.toContain("DOCKER_CALLED");
  });

  it("explains how to install Docker when its CLI is missing", () => {
    const result = runScript({ missing: "docker" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Docker Desktop");
    expect(result.stderr).toContain("https://docs.docker.com/desktop/setup/install/mac-install/");
  });

  it.each(["curl", "openssl", "open"])("identifies missing %s before using Docker", (name) => {
    const result = runScript({ missing: name, docker: "echo DOCKER_CALLED >&2" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(name);
    expect(result.stderr).not.toContain("DOCKER_CALLED");
  });

  it("points to macOS help when its open command is unavailable", () => {
    const result = runScript({ missing: "open" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("https://support.apple.com/macos");
  });

  it("explains when Docker Desktop cannot be opened", () => {
    const result = runScript({
      docker: `case "$*" in
  "context show") printf 'desktop-linux\\n' ;;
  "info") exit 1 ;;
esac`,
      open: `if [ "$1" = '-a' ]; then exit 1; fi`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Docker Desktop");
    expect(result.stderr).toContain("https://docs.docker.com/desktop/setup/install/mac-install/");
  });

  it("shows the safe command for a different Docker context", () => {
    const result = runScript({ docker: "printf 'default\\n'" });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("docker context use desktop-linux");
  });

  it("keeps the normal path when all prerequisites are present", () => {
    const result = runScript();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Ready: http://localhost:3000");
  });
});
