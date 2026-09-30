export function parseLabels(value: string): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const line of value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)) {
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`Expected KEY=VALUE: ${line}`);
    labels[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  return labels;
}
