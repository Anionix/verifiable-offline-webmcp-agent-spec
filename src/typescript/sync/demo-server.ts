// information_uuid_v5=1c19533b-0080-5bb2-9bb7-23cf6499e4ce
// event_uuid_v7=01a04921-880a-7765-8c4f-14be9735376a
// machine-contract: GET_ONLY_PUBLIC_EVIDENCE; this server exposes no approval, execution, notification, mutation, or private-key route.
import { createServer, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const publicDirectory = join(repositoryRoot, "examples/offline-sync-demo");
const port = Number(process.env.OFFLINE_SYNC_DEMO_PORT ?? "4174");
const host = "127.0.0.1";

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError("OFFLINE_SYNC_DEMO_PORT must be 1024-65535");

const files = new Map<string, readonly [string, string]>([
  ["/", [join(publicDirectory, "index.html"), "text/html; charset=utf-8"]],
  ["/app.js", [join(publicDirectory, "app.js"), "text/javascript; charset=utf-8"]],
  ["/visual-state.js", [join(publicDirectory, "visual-state.js"), "text/javascript; charset=utf-8"]],
  ["/styles.css", [join(publicDirectory, "styles.css"), "text/css; charset=utf-8"]],
  ["/evidence.json", [join(repositoryRoot, "metadata/offline-sync-verification.json"), "application/json; charset=utf-8"]],
  ["/ingestion.ndjson", [join(repositoryRoot, "data/audit/offline-sync-ingestion.ndjson"), "application/x-ndjson; charset=utf-8"]],
] as const);

function headers(response: ServerResponse): void {
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
      headers(response);
      response.writeHead(request.method === "GET" || request.method === "HEAD" ? 404 : 405, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "read-only route not found" }));
      return;
    }
    const [path, contentType] = item;
    const contents = await readFile(path);
    headers(response);
    response.writeHead(200, { "Content-Type": contentType });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch (error) {
    headers(response);
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "unexpected error" }));
  }
});

server.listen(port, host, () => console.log(`Offline sync evidence demo: http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
