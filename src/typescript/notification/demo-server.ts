// information_uuid_v5=ce2ab902-2301-5254-8ecd-362b63b7949c
// event_uuid_v7=01a04872-0565-797d-93af-3f08082f13ce
// machine-contract: localhost and same-origin only; approval and execution remain separate HTTP requests.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditLog } from "./audit-log.ts";
import { NotificationEngine } from "./engine.ts";
import { NotificationStore } from "./store.ts";
import type { Presence } from "./types.ts";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const publicDirectory = join(repositoryRoot, "examples/notification-demo");
const localDirectory = join(repositoryRoot, ".local");
const databasePath = process.env.NOTIFICATION_DEMO_DATABASE ?? join(localDirectory, "notification-demo.sqlite");
const auditPath = process.env.NOTIFICATION_DEMO_AUDIT ?? join(localDirectory, "notification-audit.ndjson");
const port = Number(process.env.NOTIFICATION_DEMO_PORT ?? "4173");
const host = "127.0.0.1";

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError("NOTIFICATION_DEMO_PORT must be 1024-65535");

const store = new NotificationStore(databasePath);
const engine = new NotificationEngine({ store, audit: new AuditLog(auditPath) });
const staticFiles = new Map<string, readonly [string, string]>([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/service-worker.js", ["service-worker.js", "text/javascript; charset=utf-8"]],
] as const);

function securityHeaders(response: ServerResponse): void {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; worker-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function json(response: ServerResponse, status: number, value: unknown): void {
  securityHeaders(response);
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  if (request.headers["content-type"]?.split(";", 1)[0] !== "application/json") {
    throw new TypeError("Content-Type must be application/json");
  }
  let value = "";
  for await (const chunk of request) {
    value += String(chunk);
    if (Buffer.byteLength(value, "utf8") > 8192) throw new RangeError("request body exceeds 8192 bytes");
  }
  const parsed: unknown = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new TypeError("JSON object required");
  return parsed as Record<string, unknown>;
}

function stringField(input: Record<string, unknown>, name: string): string {
  const value = input[name];
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  return value;
}

function requireSameOrigin(request: IncomingMessage): void {
  const origin = request.headers.origin;
  const expected = `http://${host}:${port}`;
  if (origin !== expected) throw new TypeError(`origin must be ${expected}`);
}

async function api(request: IncomingMessage, response: ServerResponse, pathname: string, search: URLSearchParams): Promise<void> {
  if (request.method === "GET" && pathname === "/api/status") {
    const intentId = search.get("intentId") ?? "";
    const intent = engine.getIntent(intentId);
    json(response, intent ? 200 : 404, { intent, audit: engine.audit.verify() });
    return;
  }
  if (request.method !== "POST") {
    json(response, 405, { error: "method-not-allowed" });
    return;
  }
  requireSameOrigin(request);
  const input = await body(request);
  if (pathname === "/api/preview") {
    const intent = engine.createIntent({
      logicalOperationId: stringField(input, "logicalOperationId"),
      title: stringField(input, "title"),
      body: stringField(input, "body"),
    });
    const preview = await engine.preview(intent.intentId);
    json(response, 200, { preview, intent: engine.getIntent(intent.intentId) });
    return;
  }
  const intentId = stringField(input, "intentId");
  if (pathname === "/api/approve-and-claim") {
    engine.approve(intentId, 120_000);
    json(response, 200, engine.claimBrowserExecution(intentId));
    return;
  }
  if (pathname === "/api/receipt") {
    const activeCount = input.activeCount;
    if (!Number.isSafeInteger(activeCount) || Number(activeCount) < 1) throw new TypeError("activeCount must be a positive integer");
    json(response, 200, engine.confirmBrowserReceipt(intentId, { activeCount: Number(activeCount), tag: intentId }));
    return;
  }
  if (pathname === "/api/reconcile") {
    const presence = stringField(input, "presence") as Presence;
    if (!["PRESENT", "ABSENT", "UNKNOWN"].includes(presence)) throw new TypeError("invalid presence");
    json(response, 200, engine.reconcileBrowser(intentId, presence));
    return;
  }
  if (pathname === "/api/reset-confirmed-absent") {
    json(response, 200, { intent: engine.resetAfterConfirmedAbsent(intentId) });
    return;
  }
  json(response, 404, { error: "not-found" });
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${host}:${port}`);
    if (url.pathname.startsWith("/api/")) {
      await api(request, response, url.pathname, url.searchParams);
      return;
    }
    const item = staticFiles.get(url.pathname);
    if (!item || request.method !== "GET") {
      json(response, 404, { error: "not-found" });
      return;
    }
    const [file, contentType] = item;
    const contents = await readFile(join(publicDirectory, file));
    securityHeaders(response);
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    json(response, 400, { error: message });
  }
});

server.listen(port, host, () => {
  console.log(`Duplicate-safe notification demo: http://${host}:${port}`);
  console.log(`SQLite: ${databasePath}`);
  console.log(`Audit log: ${auditPath}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      store.close();
      process.exit(0);
    });
  });
}
