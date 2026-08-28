// information_uuid_v5=c57b56c0-292b-5d11-97cc-3d598535cccc
// event_uuid_v7=01a0493d-49b9-780b-bbf0-96688c286703
// machine-contract: GET_ONLY_PUBLIC_PLANNER_EVIDENCE; this server exposes no model call, credential, approval, execution, notification, or mutation route.
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const publicDirectory = join(repositoryRoot, "examples/online-planner-demo");
const port = Number(process.env.ONLINE_PLANNER_DEMO_PORT ?? "4175");
const host = "127.0.0.1";

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError("ONLINE_PLANNER_DEMO_PORT must be 1024-65535");

const files = new Map<string, readonly [string, string]>([
  ["/", [join(publicDirectory, "index.html"), "text/html; charset=utf-8"]],
  ["/app.js", [join(publicDirectory, "app.js"), "text/javascript; charset=utf-8"]],
  ["/visual-state.js", [join(publicDirectory, "visual-state.js"), "text/javascript; charset=utf-8"]],
  ["/styles.css", [join(publicDirectory, "styles.css"), "text/css; charset=utf-8"]],
  ["/evidence.json", [join(repositoryRoot, "metadata/online-planner-verification.json"), "application/json; charset=utf-8"]],
  ["/audit.ndjson", [join(repositoryRoot, "data/audit/online-planner-events.ndjson"), "application/x-ndjson; charset=utf-8"]],
  ["/request.json", [join(publicDirectory, "request.sample.json"), "application/json; charset=utf-8"]],
] as const);

function setHeaders(response: ServerResponse): void {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-store");
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    const item = files.get(url.pathname);
    if (!item || !["GET", "HEAD"].includes(request.method ?? "")) {
      setHeaders(response);
      response.writeHead(["GET", "HEAD"].includes(request.method ?? "") ? 404 : 405, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "read-only route not found" }));
      return;
    }
    const [path, contentType] = item;
    const contents = await readFile(path);
    setHeaders(response);
    response.writeHead(200, { "Content-Type": contentType, "Content-Length": contents.byteLength });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch {
    setHeaders(response);
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "public evidence unavailable" }));
  }
});

server.listen(port, host, () => {
  console.log(`online planner evidence demo: http://${host}:${port}`);
});
