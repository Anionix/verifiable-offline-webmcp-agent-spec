// @ts-check
// information_uuid_v5=60dd0f0c-e4aa-522d-ae06-7d7c316de6db
// event_uuid_v7=01a048f8-3326-7d54-adbd-0cfb99718a56
// machine-contract: DISCOVER -> REGISTER_SAME_ORIGIN -> PROJECT_UNTRUSTED_INPUT -> SERVER_DERIVED_PROVENANCE -> DRY_RUN_READBACK; no permission request or visible notification is reachable here.

import {
  NOTIFICATION_TOOL_INPUT_SCHEMA,
  NotificationInputError,
  projectNotificationToolInput,
} from "../notification/input-projection.js";

export const NOTIFICATION_WEBMCP_TOOL_NAME = "notify_once";
const UUID_V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA_256 = /^[0-9a-f]{64}$/;
const PROVENANCE_FIELDS = Object.freeze([
  "channel",
  "sourceTrust",
  "sourceOrigin",
  "untrustedContent",
  "annotation",
  "derivation",
]);

/** @typedef {{ logicalOperationId: string, title: string, body: string }} NotificationToolInput */
/** @typedef {{ signal?: AbortSignal }} ToolExecutionOptions */
/** @typedef {{ registerTool: (tool: Record<string, unknown>, options: Record<string, unknown>) => Promise<unknown> | unknown }} ModelContextLike */
/** @typedef {{ document?: { modelContext?: ModelContextLike }, location?: { origin?: string } }} WebMcpRuntime */
/** @typedef {{ channel: "WEBMCP", sourceTrust: "UNTRUSTED", sourceOrigin: string, untrustedContent: true, annotation: "UNTRUSTED_LITERAL" }} AdapterInputObservation */
/** @typedef {{ type: string, observation?: AdapterInputObservation, input?: Readonly<NotificationToolInput>, error?: unknown, result?: unknown }} AdapterLifecycleEvent */
/** @typedef {(input: Readonly<NotificationToolInput>, context: { channel: "WEBMCP", signal?: AbortSignal }) => Promise<unknown>} PreviewHandler */

/** @template {Record<string, unknown>} T @param {T} value @returns {Readonly<T>} */
function immutable(value) {
  return Object.freeze(/** @type {T} */ ({ ...value }));
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

/** @param {string} origin @returns {Readonly<AdapterInputObservation>} */
function observeInput(origin) {
  return immutable({
    channel: "WEBMCP",
    sourceTrust: "UNTRUSTED",
    sourceOrigin: origin,
    untrustedContent: true,
    annotation: "UNTRUSTED_LITERAL",
  });
}

/** @param {Record<string, unknown>} left @param {Record<string, unknown>} right */
function sameProvenance(left, right) {
  return PROVENANCE_FIELDS.every((field) => left[field] === right[field]);
}

/** @param {unknown} value */
function readPersistedProvenance(value) {
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
  if (record.channel === "TYPED_INTERNAL") {
    return record.sourceTrust === "TRUSTED_INTERNAL"
      && record.sourceOrigin === "LOCAL_PROCESS"
      && record.untrustedContent === false
      && record.annotation === "TRUSTED_INTERNAL"
      && record.derivation === "INTERNAL_CALL" ? record : null;
  }
  if (!["WEBMCP", "LOCAL_FORM"].includes(/** @type {string} */ (record.channel))) return null;
  try {
    if (typeof record.sourceOrigin !== "string") return null;
    const parsed = new URL(record.sourceOrigin);
    return parsed.origin === record.sourceOrigin
      && record.sourceOrigin.length <= 256
      && record.sourceTrust === "UNTRUSTED"
      && record.untrustedContent === true
      && record.annotation === "UNTRUSTED_LITERAL"
      && record.derivation === "SERVER_ROUTE" ? record : null;
  } catch {
    return null;
  }
}

/** @param {unknown} result @param {string} origin */
function sanitizeDryRunResult(result, origin) {
  if (result === null || typeof result !== "object") throw new TypeError("dry-run response must be an object");
  const envelope = /** @type {Record<string, any>} */ (result);
  const intent = envelope.intent;
  const preview = envelope.preview;
  const inputEvidence = envelope.inputEvidence;
  const invocation = readPersistedProvenance(inputEvidence?.invocation);
  const persisted = readPersistedProvenance(inputEvidence?.persisted);
  const auditPersisted = readPersistedProvenance(inputEvidence?.auditPersisted);
  const invocationMatchesPersisted = invocation && persisted && sameProvenance(invocation, persisted);
  const sqliteMatchesAudit = persisted && auditPersisted && sameProvenance(persisted, auditPersisted);
  if (
    !intent
    || !preview
    || !invocation
    || !persisted
    || !auditPersisted
    || !UUID_V5.test(intent.intentId)
    || intent.target !== "local-mac-notification"
    || !SHA_256.test(intent.payloadDigest)
    || intent.controlState !== "DRY_RUN"
    || intent.effectState !== "NOT_STARTED"
    || preview.intentId !== intent.intentId
    || preview.payloadDigest !== intent.payloadDigest
    || preview.approvalRequired !== true
    || invocation.channel !== "WEBMCP"
    || invocation.sourceTrust !== "UNTRUSTED"
    || invocation.sourceOrigin !== origin
    || invocation.untrustedContent !== true
    || invocation.annotation !== "UNTRUSTED_LITERAL"
    || invocation.derivation !== "SERVER_ROUTE"
    || inputEvidence.matchesPersisted !== invocationMatchesPersisted
    || inputEvidence.sqliteMatchesAudit !== true
    || sqliteMatchesAudit !== true
    || !UUID_V7.test(inputEvidence.persistedEventId)
    || inputEvidence.persistedEventId !== inputEvidence.auditEventId
  ) throw new TypeError("dry-run provenance readback mismatch");

  return immutable({
    intentId: intent.intentId,
    target: intent.target,
    payloadDigest: intent.payloadDigest,
    controlState: intent.controlState,
    effectState: intent.effectState,
    humanApprovalRequired: true,
    inputEvidence: immutable({
      channel: invocation.channel,
      sourceTrust: invocation.sourceTrust,
      sourceOrigin: invocation.sourceOrigin,
      untrustedContent: invocation.untrustedContent,
      annotation: invocation.annotation,
      derivation: invocation.derivation,
      matchesPersisted: inputEvidence.matchesPersisted,
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
 * The only module allowed to touch the draft document.modelContext API.
 *
 * @param {{ runtime?: WebMcpRuntime, preview: PreviewHandler, onLifecycle?: (event: AdapterLifecycleEvent) => void }} options
 */
export async function registerNotificationWebMcpTool(options) {
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
      name: NOTIFICATION_WEBMCP_TOOL_NAME,
      title: "Prepare one duplicate-safe local notification",
      description: "Creates a persistent local dry-run intent from three literal fields. It cannot request notification permission or create a visible notification.",
      inputSchema: NOTIFICATION_TOOL_INPUT_SCHEMA,
      annotations: Object.freeze({
        readOnlyHint: false,
        untrustedContentHint: false,
      }),
      execute: async (/** @type {unknown} */ input, executionOptions = {}) => {
        const toolOptions = /** @type {ToolExecutionOptions} */ (executionOptions);
        onLifecycle({ type: "INPUT_RECEIVED", observation });
        let projected;
        try {
          toolOptions.signal?.throwIfAborted();
          projected = projectNotificationToolInput(input);
        } catch (error) {
          onLifecycle({ type: "INPUT_REJECTED", observation, error });
          throw error;
        }
        onLifecycle({ type: "INPUT_ACCEPTED", observation, input: projected });
        try {
          const result = await options.preview(projected, {
            channel: "WEBMCP",
            signal: toolOptions.signal,
          });
          toolOptions.signal?.throwIfAborted();
          const sanitized = sanitizeDryRunResult(result, origin);
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
    toolName: NOTIFICATION_WEBMCP_TOOL_NAME,
    origin,
    exposure: "SAME_ORIGIN",
    readOnlyHint: false,
    untrustedContentHint: false,
  });
}

export { NotificationInputError };
