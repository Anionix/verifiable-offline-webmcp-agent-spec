// information_uuid_v5=ce2ab902-2301-5254-8ecd-362b63b7949c
// event_uuid_v7=01a04872-0565-797d-93af-3f08082f13ce
// machine-contract: localhost and same-origin only; approval and execution remain separate HTTP requests.
// event_uuid_v7=01a048b7-262a-7dc0-a907-cce53d32aa5b
// machine-contract: the visualization reads the SQLite effect-start count; it never substitutes a decorative fixed value.
// information_uuid_v5=51b1b201-3e72-55c9-91bd-6478d3a79507
// event_uuid_v7=01a048da-1888-70e0-ae63-0eeaf0ec9fde
// machine-contract: same-origin JSON is strictly projected before createIntent; rejection leaves SQLite and the audit chain unchanged.
// information_uuid_v5=43ec07f2-3321-504a-8481-6358beea3856
// event_uuid_v7=01a04984-7ca1-717d-a8bb-4eceafaedc31
// machine-contract: WebMCP tools use the draft specification's default self allowlist; unsupported browsers receive no unknown tools directive.
// information_uuid_v5=86a5edfe-a906-5771-8c0f-4dadad5aaebf
// event_uuid_v7=01a04cd1-5eaa-70e9-aa80-545fb4d96d5d
// state_transition=ENVIRONMENT_SELECTED_STORAGE -> FIXED_REPOSITORY_LOCAL_STORAGE occurred_at=2026-08-29T09:19:44.810Z
// machine-contract: environment input may select the local port only; it can never select a SQLite or audit-log path.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AuditLog } from "./audit-log.ts";
import { NotificationEngine } from "./engine.ts";
import { NotificationInputError } from "./input-projection.js";
import { assertExpectedOrigin, externalInputProvenance } from "./input-provenance.ts";
import { prepareNotificationPreview } from "./preview-boundary.ts";
import { NotificationStore } from "./store.ts";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const publicDirectory = join(repositoryRoot, "examples/notification-demo");
const localDirectory = join(repositoryRoot, ".local");
const databasePath = join(localDirectory, "notification-demo.sqlite");
const auditPath = join(localDirectory, "notification-audit.ndjson");
const port = Number(process.env.NOTIFICATION_DEMO_PORT ?? "4173");
const host = "127.0.0.1";
const expectedOrigin = `http://${host}:${port}`;

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new TypeError("NOTIFICATION_DEMO_PORT must be 1024-65535");

const store = new NotificationStore(databasePath);
const engine = new NotificationEngine({ store, audit: new AuditLog(auditPath) });
const staticFiles = new Map<string, readonly [string, string]>([
  ["/", [join(publicDirectory, "index.html"), "text/html; charset=utf-8"]],
  ["/app.js", [join(publicDirectory, "app.js"), "text/javascript; charset=utf-8"]],
  ["/visual-state.js", [join(publicDirectory, "visual-state.js"), "text/javascript; charset=utf-8"]],
  ["/input-projection.js", [join(moduleDirectory, "input-projection.js"), "text/javascript; charset=utf-8"]],
  ["/notification/input-projection.js", [join(moduleDirectory, "input-projection.js"), "text/javascript; charset=utf-8"]],
  ["/webmcp-notification-adapter.js", [join(repositoryRoot, "src/typescript/webmcp/notification-adapter.js"), "text/javascript; charset=utf-8"]],
  ["/styles.css", [join(publicDirectory, "styles.css"), "text/css; charset=utf-8"]],
  ["/service-worker.js", [join(publicDirectory, "service-worker.js"), "text/javascript; charset=utf-8"]],
] as const);

function securityHeaders(response: ServerResponse): void {
  response.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; worker-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  response.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  response.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
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

function stringArrayField(input: Record<string, unknown>, name: string): readonly string[] {
  const value = input[name];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new TypeError(`${name} must be an array of strings`);
  }
  return Object.freeze([...value]);
}

function requireSameOrigin(request: IncomingMessage): string {
  return assertExpectedOrigin(request.headers.origin, expectedOrigin);
}

async function api(request: IncomingMessage, response: ServerResponse, pathname: string, search: URLSearchParams): Promise<void> {
  if (request.method === "GET" && pathname === "/api/status") {
    const intentId = search.get("intentId") ?? "";
    const intent = engine.getIntent(intentId);
    json(response, intent ? 200 : 404, {
      intent,
      effectStartCount: engine.getEffectStartCount(intentId),
      audit: engine.audit.verify(),
    });
    return;
  }
  if (request.method !== "POST") {
    json(response, 405, { error: "method-not-allowed" });
    return;
  }
  const sourceOrigin = requireSameOrigin(request);
  const input = await body(request);
  if (pathname === "/api/preview" || pathname === "/api/webmcp-preview") {
    const channel = pathname === "/api/webmcp-preview" ? "WEBMCP" : "LOCAL_FORM";
    const provenance = externalInputProvenance(channel, sourceOrigin, expectedOrigin);
    json(response, 200, await prepareNotificationPreview(engine, input, provenance));
    return;
  }
  const intentId = stringField(input, "intentId");
  if (pathname === "/api/approve-and-claim") {
    engine.approve(intentId, 120_000);
    json(response, 200, engine.claimBrowserExecution(intentId));
    return;
  }
  if (pathname === "/api/receipt") {
    const activeTags = stringArrayField(input, "activeTags");
    if (activeTags.length !== 1) throw new TypeError("receipt requires exactly one active notification");
    json(response, 200, engine.confirmBrowserReceipt(intentId, { activeTags }));
    return;
  }
  if (pathname === "/api/reconcile") {
    const activeTags = stringArrayField(input, "activeTags");
    json(response, 200, engine.reconcileBrowser(intentId, { activeTags }));
    return;
  }
  if (pathname === "/api/reset-confirmed-absent") {
    json(response, 409, {
      code: "TRUSTED_REPLAY_EVIDENCE_REQUIRED",
      error: "この画面だけでは権限・版・同意・期限・前提条件を独立確認できないため、再送を停止しました",
      intentId,
    });
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
    const [filePath, contentType] = item;
    const contents = await readFile(filePath);
    securityHeaders(response);
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
    response.end(contents);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unexpected error";
    const code = error instanceof NotificationInputError ? error.code : "REQUEST_REJECTED";
    const field = error instanceof NotificationInputError ? error.field ?? null : null;
    json(response, 400, { error: message, code, field });
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
