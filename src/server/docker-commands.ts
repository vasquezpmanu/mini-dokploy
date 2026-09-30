export function buildImageArgs(dockerfile: string, image: string, context: string): string[] {
  return [
    "buildx",
    "build",
    "--load",
    "--progress=plain",
    "--file",
    dockerfile,
    "--tag",
    image,
    context,
  ];
}

export function createServiceArgs(
  name: string,
  image: string,
  network: string,
  labels: Record<string, string>,
): string[] {
  const args = [
    "service",
    "create",
    "--detach=true",
    "--no-resolve-image",
    "--name",
    name,
    "--network",
    network,
    "--replicas",
    "1",
    "--log-driver",
    "json-file",
    "--update-failure-action=rollback",
  ];
  for (const [key, value] of Object.entries(labels)) args.push("--label", `${key}=${value}`);
  return [...args, image];
}

export function updateServiceArgs(name: string, image: string): string[] {
  return [
    "service",
    "update",
    "--detach=true",
    "--no-resolve-image",
    "--update-failure-action=rollback",
    "--image",
    image,
    name,
  ];
}

export function readServiceReplicas(output: string, name: string): string | null {
  const line = output.split("\n").find((entry) => entry.startsWith(`${name} `));
  return line?.trim().split(/\s+/)[1] ?? null;
}
