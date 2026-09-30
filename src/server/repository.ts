import fs from "node:fs";
import path from "node:path";

export function resolveDockerfile(repo: string, relativePath: string): string {
  const candidate = path.resolve(repo, relativePath);
  const withinRepo = (root: string, target: string) => {
    const relative = path.relative(root, target);
    return (
      relative !== "" &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  };
  try {
    if (
      withinRepo(repo, candidate) &&
      withinRepo(fs.realpathSync(repo), fs.realpathSync(candidate)) &&
      fs.statSync(candidate).isFile()
    ) {
      return candidate;
    }
  } catch {
    /* missing file or broken link */
  }
  throw new Error("Dockerfile must be a regular file inside the repository.");
}
