// @ts-check
// information_uuid_v5=08b5b50e-6867-5cde-8da1-2f87116fa223
// event_uuid_v7=01a04a5f-510a-76c4-8b88-13ad4e96383d
// event_uuid_v7=01a04a69-2b07-7a08-84d1-7fe5c482b921 state_transition=RESOURCE_REVIEWED -> EVALUATION_ALIGNED occurred_at=2026-08-28T22:06:43Z
// state_transition=DISCOVERED -> REGISTERED occurred_at=2026-08-28T22:05:45.738Z
// machine-contract: WebMCP may persist a strictly projected dry run in IndexedDB, but it cannot request notification permission or start a visible notification.

import {
  NOTIFICATION_TOOL_INPUT_SCHEMA,
  NotificationInputError,
  projectNotificationToolInput,
} from "/input-projection.js";

export const PUBLIC_NOTIFICATION_TOOL_NAME = "notify_once";

const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256 = /^[0-9a-f]{64}$/;
const IMMUTABLE_FIELDS = Object.freeze([
  "intentId",
  "logicalOperationId",
  "payloadDigest",
  "target",
  "title",
  "body",
]);
const PROVENANCE_FIELDS = Object.freeze([
  "channel",
  "sourceTrust",
  "sourceOrigin",
  "untrustedContent",
  "annotation",
  "derivation",
  "storageKind",
]);

/** @typedef {{ logicalOperationId: string, title: string, body: string }} NotificationToolInput */
/** @typedef {{ registerTool: (tool: Record<string, unknown>, options?: Record<string, unknown>) => unknown }} ModelContextLike */
/** @typedef {{ document?: { modelContext?: ModelContextLike }, location?: { origin?: string } }} WebMcpRuntime */

/** @template {Record<string, unknown>} T @param {T} value */
function immutable(value) {
  return Object.freeze({ ...value });
}

/** @param {unknown} value */
function canonicalOrigin(value) {
  if (typeof value !== "string" || value.length > 256) throw new TypeError("WebMCP origin is unavailable");
  const parsed = new URL(value);
  if (parsed.origin !== value) throw new TypeError("WebMCP origin must be canonical");
  const loopback = parsed.protocol === "http:"
    && ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !loopback) throw new TypeError("WebMCP origin must be potentially trustworthy");
  return value;
}

/** @param {string} origin */
function observeInput(origin) {
  return immutable({
    channel: "WEBMCP",
    sourceTrust: "UNTRUSTED",
    sourceOrigin: origin,
    untrustedContent: true,
    annotation: "UNTRUSTED_LITERAL",
    derivation: "INDEXED_DB_TRANSACTION",
    storageKind: "INDEXED_DB",
  });
}

/** @param {unknown} value */
function readBrowserProvenance(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const source = /** @type {Record<string, unknown>} */ (value);
  const keys = Reflect.ownKeys(source);
  if (keys.length !== PROVENANCE_FIELDS.length || keys.some((key) => {
    return typeof key !== "string" || !PROVENANCE_FIELDS.includes(key);
  })) return null;
  const descriptors = Object.getOwnPropertyDescriptors(source);
  if (PROVENANCE_FIELDS.some((field) => {
    const descriptor = descriptors[field];
    return !descriptor || !("value" in descriptor) || descriptor.enumerable !== true;
  })) return null;
  const record = Object.fromEntries(PROVENANCE_FIELDS.map((field) => [field, descriptors[field].value]));
  if (!["WEBMCP", "LOCAL_FORM"].includes(/** @type {string} */ (record.channel))) return null;
  try {
    if (typeof record.sourceOrigin !== "string") return null;
    const parsed = new URL(record.sourceOrigin);
    return parsed.origin === record.sourceOrigin
      && record.sourceTrust === "UNTRUSTED"
      && record.untrustedContent === true
      && record.annotation === "UNTRUSTED_LITERAL"
      && record.derivation === "INDEXED_DB_TRANSACTION"
      && record.storageKind === "INDEXED_DB" ? record : null;
  } catch {
    return null;
  }
}

/** @param {Record<string, unknown>} left @param {Record<string, unknown>} right */
function sameProvenance(left, right) {
  return PROVENANCE_FIELDS.every((field) => left[field] === right[field]);
}

/** @param {Record<string, unknown>} left @param {Record<string, unknown>} right */
function sameIntent(left, right) {
  return IMMUTABLE_FIELDS.every((field) => left[field] === right[field]);
}

/** @param {Record<string, unknown>} intent */
function supportedState(intent) {
  return [
    "DRY_RUN/NOT_STARTED",
    "USER_APPROVED/NOT_STARTED",
    "ABORTED/NOT_STARTED",
    "EXECUTING/AMBIGUOUS",
    "VERIFIED/CONFIRMED_PRESENT",
  ].includes(`${intent.controlState}/${intent.effectState}`);
}

/**
 * @param {unknown} result
 * @param {string} origin
 * @param {Readonly<NotificationToolInput>} input
 */
function sanitizeDryRunResult(result, origin, input) {
  if (result === null || typeof result !== "object") throw new TypeError("dry-run response must be an object");
  const envelope = /** @type {Record<string, any>} */ (result);
  const intent = envelope.intent;
  const persistedIntent = envelope.status?.intent;
  const effectStartCount = envelope.status?.effectStartCount;
  const invocation = readBrowserProvenance(envelope.inputEvidence?.invocation);
  const persisted = readBrowserProvenance(envelope.inputEvidence?.persisted);
  const auditPersisted = readBrowserProvenance(envelope.inputEvidence?.auditPersisted);
  const invocationMatchesPersisted = invocation && persisted && sameProvenance(invocation, persisted);
  const storeMatchesAudit = persisted && auditPersisted && sameProvenance(persisted, auditPersisted);

  if (
    !intent
    || !persistedIntent
    || !envelope.preview
    || !invocation
    || !persisted
    || !auditPersisted
    || !UUID_V5.test(intent.intentId)
    || intent.target !== "browser-notification"
    || !SHA_256.test(intent.payloadDigest)
    || envelope.preview.intentId !== intent.intentId
    || envelope.preview.payloadDigest !== intent.payloadDigest
    || envelope.preview.approvalRequired !== true
    || !sameIntent(intent, persistedIntent)
    || intent.logicalOperationId !== input.logicalOperationId
    || intent.title !== input.title
    || intent.body !== input.body
    || !supportedState(persistedIntent)
    || !Number.isSafeInteger(effectStartCount)
    || effectStartCount < 0
    || invocation.channel !== "WEBMCP"
    || invocation.sourceOrigin !== origin
    || envelope.inputEvidence.matchesPersisted !== invocationMatchesPersisted
    || envelope.inputEvidence.storeMatchesAudit !== true
    || storeMatchesAudit !== true
    || !UUID_V7.test(envelope.inputEvidence.persistedEventId)
    || envelope.inputEvidence.persistedEventId !== envelope.inputEvidence.auditEventId
  ) throw new TypeError("browser dry-run evidence mismatch");

  return immutable({
    intentId: persistedIntent.intentId,
    target: persistedIntent.target,
    payloadDigest: persistedIntent.payloadDigest,
    controlState: persistedIntent.controlState,
    effectState: persistedIntent.effectState,
    effectStartCount,
    restored: persistedIntent.controlState !== "DRY_RUN",
    humanApprovalRequired: true,
    inputEvidence: immutable({
      channel: invocation.channel,
      sourceTrust: invocation.sourceTrust,
      sourceOrigin: invocation.sourceOrigin,
      untrustedContent: invocation.untrustedContent,
      annotation: invocation.annotation,
      derivation: invocation.derivation,
      storageKind: invocation.storageKind,
      matchesPersisted: envelope.inputEvidence.matchesPersisted,
      persistedChannel: persisted.channel,
      durableEvidenceMatch: true,
    }),
  });
}

/** @param {unknown} error */
function registrationFailure(error) {
  const name = error instanceof Error ? error.name : "UnknownError";
  if (name === "NotAllowedError") {
    return immutable({ status: "PERMISSION_DENIED", reason: "TOOLS_PERMISSION_DENIED", errorName: name });
  }
  if (name === "SecurityError") {
    return immutable({ status: "SECURITY_REJECTED", reason: "ORIGIN_NOT_TRUSTWORTHY", errorName: name });
  }
  return immutable({ status: "REGISTRATION_FAILED", reason: "REGISTER_TOOL_REJECTED", errorName: name });
}

/**
 * @param {{
 *   runtime?: WebMcpRuntime,
 *   preview: (input: Readonly<NotificationToolInput>, context: { channel: "WEBMCP", signal?: AbortSignal }) => Promise<unknown>,
 *   onLifecycle?: (event: Record<string, any>) => void
 * }} options
 */
export async function registerPublicNotificationTool(options) {
  if (!options || typeof options.preview !== "function") throw new TypeError("preview handler is required");
  const runtime = options.runtime ?? /** @type {WebMcpRuntime} */ (globalThis);
  const onLifecycle = options.onLifecycle ?? (() => {});
  const context = runtime.document?.modelContext;
  if (!context || typeof context.registerTool !== "function") {
    return immutable({ status: "UNAVAILABLE", reason: "MODEL_CONTEXT_ABSENT" });
  }
  const origin = canonicalOrigin(runtime.location?.origin);
  const observation = observeInput(origin);

  try {
    await context.registerTool({
      name: PUBLIC_NOTIFICATION_TOOL_NAME,
      title: "Prepare one duplicate-safe notification dry run",
      description: "Prepare or restore one local browser-notification intent. Use this only to save a dry run: it never requests notification permission and never displays a notification. A person must review the visible page and click approval before any delivery attempt.",
      inputSchema: NOTIFICATION_TOOL_INPUT_SCHEMA,
      annotations: Object.freeze({ readOnlyHint: false, untrustedContentHint: false }),
      execute: async (/** @type {unknown} */ input, executionOptions = {}) => {
        const signal = /** @type {{ signal?: AbortSignal }} */ (executionOptions).signal;
        onLifecycle({ type: "INPUT_RECEIVED", observation });
        let projected;
        try {
          signal?.throwIfAborted();
          projected = projectNotificationToolInput(input);
        } catch (error) {
          onLifecycle({ type: "INPUT_REJECTED", observation, error });
          throw error;
        }
        onLifecycle({ type: "INPUT_ACCEPTED", observation, input: projected });
        try {
          const result = await options.preview(projected, { channel: "WEBMCP", signal });
          signal?.throwIfAborted();
          const sanitized = sanitizeDryRunResult(result, origin, projected);
          onLifecycle({ type: "DRY_RUN_COMPLETED", observation, input: projected, result: sanitized });
          return sanitized;
        } catch (error) {
          onLifecycle({ type: "DRY_RUN_FAILED", observation, input: projected, error });
          throw error;
        }
      },
    }, { exposedTo: [] });
  } catch (error) {
    return registrationFailure(error);
  }

  return immutable({
    status: "REGISTERED",
    toolName: PUBLIC_NOTIFICATION_TOOL_NAME,
    origin,
    exposure: "SAME_ORIGIN",
    readOnlyHint: false,
    untrustedContentHint: false,
  });
}

export { NotificationInputError };
