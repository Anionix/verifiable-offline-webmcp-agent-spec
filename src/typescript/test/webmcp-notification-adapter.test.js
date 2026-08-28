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

function acceptedEnvelope(input, origin, intentId = "bdb94700-a62b-59fa-b718-ea5d5dad7ec9") {
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
      logicalOperationId: input.logicalOperationId,
      target: "local-mac-notification",
      payloadDigest,
      controlState: "DRY_RUN",
      effectState: "NOT_STARTED",
      title: input.title,
      body: input.body,
    },
    preview: { intentId, payloadDigest, approvalRequired: true },
    status: {
      intent: {
        intentId,
        logicalOperationId: input.logicalOperationId,
        target: "local-mac-notification",
        payloadDigest,
        controlState: "DRY_RUN",
        effectState: "NOT_STARTED",
        title: input.title,
        body: input.body,
      },
      effectStartCount: 0,
    },
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

// information_uuid_v5=a49f40c5-65fa-5363-b64f-be5d86766914
// event_uuid_v7=01a04a28-9e04-7709-9ce3-49b9331fd953
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T20:56:11.012Z
// machine-contract: repeated WebMCP preview accepts a newer persisted state and returns its measured effect count without requesting permission or starting an effect.
// information_uuid_v5=d2cbf4dc-f6a8-53df-ae82-e3e84f51ee7f
// information_uuid_v5=4eeca0e8-026c-559e-9496-885453aa6f30
// event_uuid_v7=01a04a5a-ece0-7715-a44c-3fe4200880af
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:51:08.000Z
// machine-contract: overlapping invocations keep input/result pairs isolated, while non-negative measured-count inconsistencies remain available to the safety-violation renderer.

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

test("adapter restores a verified persisted intent on repeated WebMCP preview", async () => {
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
        status: {
          intent: {
            ...envelope.status.intent,
            controlState: "VERIFIED",
            effectState: "CONFIRMED_PRESENT",
          },
          effectStartCount: 1,
        },
      };
    },
  });
  const output = await registeredTool.execute({
    logicalOperationId: "adapter-restored",
    title: "Title",
    body: "Body",
  });
  assert.equal(output.controlState, "VERIFIED");
  assert.equal(output.effectState, "CONFIRMED_PRESENT");
  assert.equal(output.effectStartCount, 1);
  assert.equal(output.restored, true);
});

test("adapter passes measured-count inconsistencies to the violation renderer", async () => {
  const origin = "https://example.test";
  let registeredTool;
  await registerNotificationWebMcpTool({
    runtime: {
      location: { origin },
      document: { modelContext: { registerTool(tool) { registeredTool = tool; } } },
    },
    preview: async (input) => {
      const envelope = acceptedEnvelope(input, origin);
      const verified = input.logicalOperationId === "count-two";
      return {
        ...envelope,
        status: {
          intent: {
            ...envelope.status.intent,
            controlState: verified ? "VERIFIED" : "DRY_RUN",
            effectState: verified ? "CONFIRMED_PRESENT" : "NOT_STARTED",
          },
          effectStartCount: verified ? 2 : 1,
        },
      };
    },
  });
  const dryRunMismatch = await registeredTool.execute({
    logicalOperationId: "count-one",
    title: "Title one",
    body: "Body one",
  });
  const verifiedMismatch = await registeredTool.execute({
    logicalOperationId: "count-two",
    title: "Title two",
    body: "Body two",
  });
  assert.equal(dryRunMismatch.effectStartCount, 1);
  assert.equal(verifiedMismatch.effectStartCount, 2);
});

test("overlapping executions emit only their own lifecycle input and result", async () => {
  const origin = "https://example.test";
  const intentIds = new Map([
    ["overlap-a", "f9fb2e8d-7a49-52b2-990d-9180b2b55149"],
    ["overlap-b", "9ea40120-57d2-5acf-9467-d4960006d6c8"],
  ]);
  const releases = new Map();
  const completions = [];
  let registeredTool;
  await registerNotificationWebMcpTool({
    runtime: {
      location: { origin },
      document: { modelContext: { registerTool(tool) { registeredTool = tool; } } },
    },
    preview: (input) => new Promise((resolve) => {
      releases.set(input.logicalOperationId, () => resolve(acceptedEnvelope(
        input,
        origin,
        intentIds.get(input.logicalOperationId),
      )));
    }),
    onLifecycle: (event) => {
      if (event.type === "DRY_RUN_COMPLETED") completions.push(event);
    },
  });
  const executionA = registeredTool.execute({ logicalOperationId: "overlap-a", title: "A", body: "A body" });
  const executionB = registeredTool.execute({ logicalOperationId: "overlap-b", title: "B", body: "B body" });
  releases.get("overlap-b")();
  await executionB;
  releases.get("overlap-a")();
  await executionA;

  assert.deepEqual(completions.map((event) => [event.input.logicalOperationId, event.result.intentId]), [
    ["overlap-b", intentIds.get("overlap-b")],
    ["overlap-a", intentIds.get("overlap-a")],
  ]);
});

test("adapter rejects a persisted intent that does not belong to the projected invocation", async () => {
  const origin = "https://example.test";
  let registeredTool;
  await registerNotificationWebMcpTool({
    runtime: {
      location: { origin },
      document: { modelContext: { registerTool(tool) { registeredTool = tool; } } },
    },
    preview: async (input) => {
      const envelope = acceptedEnvelope(input, origin);
      envelope.intent.title = "different invocation";
      envelope.status.intent.title = "different invocation";
      return envelope;
    },
  });
  await assert.rejects(
    registeredTool.execute({ logicalOperationId: "bound-input", title: "Expected", body: "Body" }),
    /dry-run provenance readback mismatch/,
  );
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
  assert.doesNotMatch(app, /pendingResult/);
  assert.match(app, /event\.result/);
  assert.doesNotMatch(adapter, /Notification\.requestPermission/);
});
