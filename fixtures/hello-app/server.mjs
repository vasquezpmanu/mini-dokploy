import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3000);
createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  response.end("Hello from Mini-Dokploy!\n");
}).listen(port, "0.0.0.0");
