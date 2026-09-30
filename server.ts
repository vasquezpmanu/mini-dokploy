import { createServer } from "node:http";
import fs from "node:fs";
import type { Duplex } from "node:stream";
import next from "next";
import { WebSocketServer } from "ws";
import { and, eq } from "drizzle-orm";
import { db } from "./src/db";
import { deployments } from "./src/db/schema";
import { auth } from "./src/server/auth";
import { logPath, reconcileInterruptedDeployments } from "./src/server/deployments";

const port = Number(process.env.PORT ?? 3000);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev, hostname: "0.0.0.0", port });
const handle = app.getRequestHandler();
const wss = new WebSocketServer({ noServer: true });

function reject(socket: Duplex, status: number): void {
  socket.write(
    `HTTP/1.1 ${status} ${status === 403 ? "Forbidden" : "Unauthorized"}\r\nConnection: close\r\n\r\n`,
  );
  socket.destroy();
}

async function main(): Promise<void> {
  await app.prepare();
  reconcileInterruptedDeployments();
  const server = createServer((req, res) => {
    void handle(req, res);
  });
  server.on("upgrade", async (req, socket, head) => {
    if (!req.url?.startsWith("/api/logs?")) return;
    try {
      const origin = req.headers.origin;
      if (origin !== (process.env.BETTER_AUTH_URL ?? "http://localhost:3000"))
        return reject(socket, 403);
      const id = new URL(req.url, "http://localhost").searchParams.get("id") ?? "";
      if (!/^[a-f0-9]{12}$/.test(id)) return reject(socket, 403);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
      }
      const session = await auth.api.getSession({ headers });
      if (!session?.user) return reject(socket, 401);
      const deployment = db
        .select()
        .from(deployments)
        .where(and(eq(deployments.id, id), eq(deployments.ownerId, session.user.id)))
        .get();
      if (!deployment) return reject(socket, 403);
      wss.handleUpgrade(req, socket, head, (ws) => {
        let offset = 0;
        try {
          offset = Math.max(0, fs.statSync(logPath(id)).size - 262_144);
        } catch {
          /* no log yet */
        }
        const flush = () => {
          if (ws.readyState !== ws.OPEN) return;
          try {
            const size = fs.statSync(logPath(id)).size;
            if (size < offset) offset = 0;
            if (size > offset) {
              const length = size - offset;
              const file = fs.openSync(logPath(id), "r");
              const chunk = Buffer.alloc(length);
              fs.readSync(file, chunk, 0, length, offset);
              fs.closeSync(file);
              offset = size;
              ws.send(chunk.toString("utf8"));
            }
          } catch {
            /* file may have been removed */
          }
        };
        flush();
        const interval = setInterval(flush, 250);
        ws.on("close", () => clearInterval(interval));
      });
    } catch {
      reject(socket, 403);
    }
  });
  server.listen(port, "0.0.0.0", () =>
    console.log(`Mini-Dokploy listening on http://localhost:${port}`),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
