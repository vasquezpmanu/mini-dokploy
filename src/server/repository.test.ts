import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveDockerfile } from "./repository";

let root: string;
let repo: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "mini-dokploy-repo-test-"));
  repo = path.join(root, "repo");
  fs.mkdirSync(path.join(repo, "docker"), { recursive: true });
  fs.writeFileSync(path.join(repo, "docker", "Dockerfile"), "FROM scratch\n");
  fs.writeFileSync(path.join(root, "outside"), "FROM scratch\n");
});

afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("Dockerfile resolution", () => {
  it("accepts a regular file in a subdirectory", () => {
    expect(resolveDockerfile(repo, "docker/Dockerfile")).toBe(
      path.join(repo, "docker", "Dockerfile"),
    );
  });

  it.each(["../outside", "missing", "docker"])("rejects %s", (candidate) => {
    expect(() => resolveDockerfile(repo, candidate)).toThrow(
      "Dockerfile must be a regular file inside the repository.",
    );
  });

  it("rejects a symlink that escapes the repository", () => {
    fs.symlinkSync(path.join(root, "outside"), path.join(repo, "Dockerfile"));
    expect(() => resolveDockerfile(repo, "Dockerfile")).toThrow(
      "Dockerfile must be a regular file inside the repository.",
    );
  });
});
