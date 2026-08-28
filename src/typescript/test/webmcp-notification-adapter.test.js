// information_uuid_v5=60dd0f0c-e4aa-522d-ae06-7d7c316de6db
// event_uuid_v7=01a048f8-3326-7d54-adbd-0cfb99718a56
// machine-contract: draft WebMCP access is isolated here; permission denial and absence stop before preview, and successful output contains no literal notification text.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  NOTIFICATION_WEBMCP_TOOL_NAME,
  NotificationInputError,
  registerNotificationWebMcpTool,
} from "../webmcp/notification-adapter.js";

function acceptedEnvelope(input, origin) {
  const intentId = "bdb94700-a62b-59fa-b718-ea5d5dad7ec9";
  const eventId = "01a048fe-b603-7ee6-a085-b7ffc52b4b81";
  const payloadDigest = "a".repeat(64);
  const provenance = {
    channel: "WEBMCP",
    sourceTrust: "UNTRUSTED",
    sourceOrigin: origin,
    untrustedContent: true,
    annotation: "UNTRUSTED_LITERAL",
    derivation: "SERVER_ROUTE",
  };
  return {
    intent: {
      intentId,
      target: "local-mac-notification",
      payloadDigest,
      controlState: "DRY_RUN",
      effectState: "NOT_STARTED",
      title: input.title,
      body: input.body,
    },
    preview: { intentId, payloadDigest, approvalRequired: true },
    inputEvidence: {
      invocation: provenance,
      persisted: provenance,
      auditPersisted: provenance,
      persistedEventId: eventId,
      auditEventId: eventId,
      matchesPersisted: true,
      sqliteMatchesAudit: true,
    },
  };
}

test("adapter reports a typed unavailable state without calling preview", async () => {
  let previewCalls = 0;
  const result = await registerNotificationWebMcpTool({
    runtime: { document: {}, location: { origin: "https://example.test" } },
    preview: async () => { previewCalls += 1; return {}; },
  });
  assert.deepEqual(result, { status: "UNAVAILABLE", reason: "MODEL_CONTEXT_ABSENT" });
  assert.equal(previewCalls, 0);
});

test("adapter registers a same-origin, state-writing, sanitized dry-run tool", async () => {
  const origin = "https://example.test";
  let registeredTool;
  let registeredOptions;
  let previewInput;
  let previewContext;
  const lifecycle = [];
  const result = await registerNotificationWebMcpTool({
    runtime: {
      location: { origin },
      document: {
        modelContext: {
          registerTool(tool, options) {
            registeredTool = tool;
            registeredOptions = options;
          },
        },
      },
    },
    preview: async (input, context) => {
      previewInput = input;
      previewContext = context;
      return acceptedEnvelope(input, origin);
    },
    onLifecycle: (event) => lifecycle.push(event.type),
  });

  assert.deepEqual(result, {
    status: "REGISTERED",
    toolName: NOTIFICATION_WEBMCP_TOOL_NAME,
    origin,
    exposure: "SAME_ORIGIN",
    readOnlyHint: false,
    untrustedContentHint: false,
  });
  assert.deepEqual(registeredOptions, { exposedTo: [] });
  assert.equal(registeredTool.name, "notify_once");
  assert.deepEqual(registeredTool.annotations, { readOnlyHint: false, untrustedContentHint: false });
  assert.equal(registeredTool.inputSchema.additionalProperties, false);
  assert.match(registeredTool.description, /persistent local dry-run intent/);
  assert.match(registeredTool.description, /cannot request notification permission or create a visible notification/);

  const output = await registeredTool.execute({
    logicalOperationId: "adapter-001",
    title: "  Cafe\u0301  ",
    body: "literal body must not be reflected",
  }, { signal: new AbortController().signal });
  assert.deepEqual(previewInput, {
    logicalOperationId: "adapter-001",
    title: "Café",
    body: "literal body must not be reflected",
  });
  assert.equal(previewContext.channel, "WEBMCP");
  assert.equal(output.controlState, "DRY_RUN");
  assert.equal(output.effectState, "NOT_STARTED");
  assert.equal(output.inputEvidence.sourceTrust, "UNTRUSTED");
  assert.equal(output.inputEvidence.matchesPersisted, true);
  assert.equal(output.inputEvidence.durableEvidenceMatch, true);
  assert.doesNotMatch(JSON.stringify(output), /Café|literal body/);
  assert.deepEqual(lifecycle, ["INPUT_RECEIVED", "INPUT_ACCEPTED", "DRY_RUN_COMPLETED"]);
});

test("adapter accepts a duplicate only when SQLite and audit preserve the same first provenance", async () => {
  const origin = "https://example.test";
  let registeredTool;
  await registerNotificationWebMcpTool({
    runtime: {
      location: { origin },
      document: { modelContext: { registerTool(tool) { registeredTool = tool; } } },
    },
    preview: async (input) => {
      const envelope = acceptedEnvelope(input, origin);
      const persisted = {
        channel: "LOCAL_FORM",
        sourceTrust: "UNTRUSTED",
        sourceOrigin: origin,
        untrustedContent: true,
        annotation: "UNTRUSTED_LITERAL",
        derivation: "SERVER_ROUTE",
      };
      return {
        ...envelope,
        inputEvidence: {
          ...envelope.inputEvidence,
          persisted,
          auditPersisted: persisted,
          matchesPersisted: false,
        },
      };
    },
  });
  const output = await registeredTool.execute({
    logicalOperationId: "adapter-duplicate",
    title: "Title",
    body: "Body",
  });
  assert.equal(output.inputEvidence.matchesPersisted, false);
  assert.equal(output.inputEvidence.persistedChannel, "LOCAL_FORM");
  assert.equal(output.inputEvidence.durableEvidenceMatch, true);
});

test("adapter rejects a claimed readback match that durable evidence does not support", async () => {
  const origin = "https://example.test";
  let registeredTool;
  await registerNotificationWebMcpTool({
    runtime: {
      location: { origin },
      document: { modelContext: { registerTool(tool) { registeredTool = tool; } } },
    },
    preview: async (input) => {
      const envelope = acceptedEnvelope(input, origin);
      return {
        ...envelope,
        inputEvidence: { ...envelope.inputEvidence, sqliteMatchesAudit: false },
      };
    },
  });
  await assert.rejects(
    registeredTool.execute({
      logicalOperationId: "adapter-mismatch",
      title: "Title",
      body: "Body",
    }),
    /dry-run provenance readback mismatch/,
  );
});

test("unknown input is rejected before preview", async () => {
  let registeredTool;
  let previewCalls = 0;
  await registerNotificationWebMcpTool({
    runtime: {
      location: { origin: "https://example.test" },
      document: { modelContext: { registerTool(tool) { registeredTool = tool; } } },
    },
    preview: async () => { previewCalls += 1; return {}; },
  });
  await assert.rejects(
    registeredTool.execute({
      logicalOperationId: "adapter-rejected",
      title: "Title",
      body: "Body",
      execute: true,
    }),
    (error) => error instanceof NotificationInputError && error.code === "UNKNOWN_FIELD",
  );
  assert.equal(previewCalls, 0);
});

test("tools permission and origin failures are discriminated", async () => {
  const permission = await registerNotificationWebMcpTool({
    runtime: {
      location: { origin: "https://example.test" },
      document: { modelContext: { registerTool() { throw new DOMException("blocked", "NotAllowedError"); } } },
    },
    preview: async () => ({}),
  });
  assert.deepEqual(permission, {
    status: "PERMISSION_DENIED",
    reason: "TOOLS_PERMISSION_DENIED",
    errorName: "NotAllowedError",
  });

  await assert.rejects(
    registerNotificationWebMcpTool({
      runtime: {
        location: { origin: "http://attacker.example" },
        document: { modelContext: { registerTool() {} } },
      },
      preview: async () => ({}),
    }),
    /potentially trustworthy/,
  );
});

test("draft API references remain isolated from the application module", async () => {
  const [adapter, app] = await Promise.all([
    readFile(new URL("../webmcp/notification-adapter.js", import.meta.url), "utf8"),
    readFile(new URL("../../../examples/notification-demo/app.js", import.meta.url), "utf8"),
  ]);
  assert.match(adapter, /document\?\.modelContext|document\.modelContext/);
  assert.match(adapter, /registerTool/);
  assert.doesNotMatch(app, /document\.modelContext/);
  assert.doesNotMatch(app, /registerTool/);
  assert.doesNotMatch(adapter, /Notification\.requestPermission/);
});
