export type PortResult = { ok: true; port: number } | { ok: false; message: string };

export function parsePort(value: string): PortResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { ok: false, message: "Choose an internal container port before deploying." };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, message: "Enter a whole-number port between 1 and 65535." };
  }
  const port = Number(trimmed);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    return { ok: false, message: "Enter a whole-number port between 1 and 65535." };
  }
  return { ok: true, port };
}
