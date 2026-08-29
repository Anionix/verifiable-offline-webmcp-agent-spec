// @ts-check
// information_uuid_v5=17299ac2-9768-58ec-b3d6-47e1891100bc
// event_uuid_v7=01a04a5f-510e-790e-9ea9-95ebbc0de7c5
// state_transition=DISCOVERED -> DRY_RUN occurred_at=2026-08-28T22:05:45.742Z
// machine-contract: one UUIDv5 intent owns one logical operation; IndexedDB commits the intent and its UUIDv7 hash-chain event together before readback is reported.

const DATABASE_NAME = "verifiable-offline-webmcp-notification-v1";
const DATABASE_VERSION = 1;
const INTENT_STORE = "intents";
const EVENT_STORE = "events";
const ROOT_NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";
const TARGET = "browser-notification";
const ZERO_HASH = "0".repeat(64);
const ALLOWED_CHANNELS = new Set(["WEBMCP", "LOCAL_FORM"]);

let databasePromise;
let localLock = Promise.resolve();

/** @param {unknown} value */
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = /** @type {Record<string, unknown>} */ (value);
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

/** @param {ArrayBuffer} value */
function bytesToHex(value) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** @param {Uint8Array} bytes */
function formatUuid(bytes) {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** @param {string} value */
function uuidBytes(value) {
  const compact = value.replaceAll("-", "");
  if (!/^[0-9a-f]{32}$/i.test(compact)) throw new TypeError("invalid UUID namespace");
  return Uint8Array.from(compact.match(/.{2}/g).map((pair) => Number.parseInt(pair, 16)));
}

/** @param {string} value */
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(digest);
}

/** @param {string} logicalOperationId */
export async function deriveIntentId(logicalOperationId) {
  const namespace = uuidBytes(ROOT_NAMESPACE);
  const name = new TextEncoder().encode(`browser-notification/${logicalOperationId}`);
  const input = new Uint8Array(namespace.length + name.length);
  input.set(namespace);
  input.set(name, namespace.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", input));
  const bytes = digest.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

/** @param {{ logicalOperationId: string, title: string, body: string }} input */
export async function digestPayload(input) {
  return sha256(canonicalJson({
    body: input.body,
    logicalOperationId: input.logicalOperationId,
    target: TARGET,
    title: input.title,
  }));
}

/** @param {number} [now] */
export function createUuidV7(now = Date.now()) {
  if (!Number.isSafeInteger(now) || now < 0 || now >= 2 ** 48) throw new TypeError("UUIDv7 timestamp is out of range");
  const bytes = new Uint8Array(16);
  let remaining = now;
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  crypto.getRandomValues(bytes.subarray(6));
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return formatUuid(bytes);
}

/** @param {IDBRequest} request */
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed")), { once: true });
  });
}

/** @param {IDBTransaction} transaction */
function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(undefined), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed")), { once: true });
  });
}

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(INTENT_STORE)) {
        const intents = database.createObjectStore(INTENT_STORE, { keyPath: "intentId" });
        intents.createIndex("logicalOperationId", "logicalOperationId", { unique: true });
      }
      if (!database.objectStoreNames.contains(EVENT_STORE)) {
        const events = database.createObjectStore(EVENT_STORE, { keyPath: "eventId" });
        events.createIndex("intentSequence", ["intentId", "sequence"], { unique: true });
      }
    });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB open failed")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("IndexedDB upgrade is blocked by another tab")), { once: true });
  });
  return databasePromise;
}

/** @template T @param {() => Promise<T>} task */
async function withLedgerLock(task) {
  if (globalThis.navigator?.locks?.request) {
    return navigator.locks.request(`${DATABASE_NAME}:ledger`, { mode: "exclusive" }, task);
  }
  const run = localLock.then(task, task);
  localLock = run.then(() => undefined, () => undefined);
  return run;
}

/** @param {string} intentId */
export async function getIntent(intentId) {
  const database = /** @type {IDBDatabase} */ (await openDatabase());
  const transaction = database.transaction(INTENT_STORE, "readonly");
  const done = transactionDone(transaction);
  const value = await requestResult(transaction.objectStore(INTENT_STORE).get(intentId));
  await done;
  return value ?? null;
}

/** @param {string} logicalOperationId */
export async function getIntentByLogicalOperation(logicalOperationId) {
  const database = /** @type {IDBDatabase} */ (await openDatabase());
  const transaction = database.transaction(INTENT_STORE, "readonly");
  const done = transactionDone(transaction);
  const value = await requestResult(transaction.objectStore(INTENT_STORE).index("logicalOperationId").get(logicalOperationId));
  await done;
  return value ?? null;
}

/** @param {string} eventId */
async function getEvent(eventId) {
  const database = /** @type {IDBDatabase} */ (await openDatabase());
  const transaction = database.transaction(EVENT_STORE, "readonly");
  const done = transactionDone(transaction);
  const value = await requestResult(transaction.objectStore(EVENT_STORE).get(eventId));
  await done;
  return value ?? null;
}

/** @param {string} intentId */
export async function listIntentEvents(intentId) {
  const database = /** @type {IDBDatabase} */ (await openDatabase());
  const transaction = database.transaction(EVENT_STORE, "readonly");
  const done = transactionDone(transaction);
  const range = IDBKeyRange.bound([intentId, 0], [intentId, Number.MAX_SAFE_INTEGER]);
  const values = await requestResult(transaction.objectStore(EVENT_STORE).index("intentSequence").getAll(range));
  await done;
  return /** @type {Array<Record<string, any>>} */ (values);
}

/** @param {Record<string, any>} intent @param {Record<string, any>} event */
async function putAndReadBack(intent, event) {
  const database = /** @type {IDBDatabase} */ (await openDatabase());
  const transaction = database.transaction([INTENT_STORE, EVENT_STORE], "readwrite");
  transaction.objectStore(INTENT_STORE).put(intent);
  transaction.objectStore(EVENT_STORE).put(event);
  await transactionDone(transaction);
  const [storedIntent, storedEvent] = await Promise.all([getIntent(intent.intentId), getEvent(event.eventId)]);
  if (
    !storedIntent
    || !storedEvent
    || storedIntent.auditHead !== event.hash
    || storedEvent.hash !== event.hash
    || storedEvent.intentId !== storedIntent.intentId
  ) throw new TypeError("IndexedDB readback mismatch");
  return { intent: storedIntent, event: storedEvent };
}

/** @param {"WEBMCP" | "LOCAL_FORM"} channel */
function provenance(channel) {
  if (!ALLOWED_CHANNELS.has(channel)) throw new TypeError("unsupported input channel");
  return Object.freeze({
    channel,
    sourceTrust: "UNTRUSTED",
    sourceOrigin: location.origin,
    untrustedContent: true,
    annotation: "UNTRUSTED_LITERAL",
    derivation: "INDEXED_DB_TRANSACTION",
    storageKind: "INDEXED_DB",
  });
}

/** @param {Record<string, any>} eventWithoutHash */
async function hashEvent(eventWithoutHash) {
  return sha256(canonicalJson(eventWithoutHash));
}

/**
 * @param {Record<string, any>} current
 * @param {{ kind: string, toControl: string, toEffect: string, effectStartCount: number, details?: Record<string, unknown> }} change
 */
async function nextMutation(current, change) {
  if (!Number.isSafeInteger(change.effectStartCount) || change.effectStartCount < 0 || change.effectStartCount > 1) {
    throw new TypeError("effectStartCount must remain within the one-effect safety budget");
  }
  if (change.effectStartCount < current.effectStartCount) throw new TypeError("effectStartCount cannot decrease");
  const transitionKey = `${change.kind}:${current.controlState}/${current.effectState}->${change.toControl}/${change.toEffect}`;
  const allowed = new Set([
    "human-approved:DRY_RUN/NOT_STARTED->USER_APPROVED/NOT_STARTED",
    "stopped-before-effect:DRY_RUN/NOT_STARTED->ABORTED/NOT_STARTED",
    "stopped-before-effect:USER_APPROVED/NOT_STARTED->ABORTED/NOT_STARTED",
    "effect-start-claimed:USER_APPROVED/NOT_STARTED->EXECUTING/AMBIGUOUS",
    "effect-presence-confirmed:EXECUTING/AMBIGUOUS->VERIFIED/CONFIRMED_PRESENT",
    "duplicate-suppressed:VERIFIED/CONFIRMED_PRESENT->VERIFIED/CONFIRMED_PRESENT",
  ]);
  if (!allowed.has(transitionKey)) throw new TypeError(`unsupported notification transition: ${transitionKey}`);
  const now = Date.now();
  const eventId = createUuidV7(now);
  const sequence = current.revision + 1;
  const next = {
    ...current,
    controlState: change.toControl,
    effectState: change.toEffect,
    effectStartCount: change.effectStartCount,
    revision: sequence,
    updatedAt: now,
  };
  const eventWithoutHash = {
    eventId,
    intentId: current.intentId,
    sequence,
    kind: change.kind,
    occurredAt: now,
    fromControl: current.controlState,
    toControl: change.toControl,
    fromEffect: current.effectState,
    toEffect: change.toEffect,
    effectStartCount: change.effectStartCount,
    previousHash: current.auditHead,
    details: change.details ?? {},
  };
  const hash = await hashEvent(eventWithoutHash);
  return {
    intent: { ...next, auditHead: hash },
    event: { ...eventWithoutHash, hash },
  };
}

/** @param {Record<string, any>} intent @param {Record<string, any>} invocation @param {Record<string, any>} persistedEvent */
function dryRunEnvelope(intent, invocation, persistedEvent) {
  const persisted = persistedEvent.details.provenance;
  const matchesPersisted = canonicalJson(invocation) === canonicalJson(persisted);
  return {
    intent,
    preview: {
      intentId: intent.intentId,
      payloadDigest: intent.payloadDigest,
      approvalRequired: true,
    },
    status: { intent, effectStartCount: intent.effectStartCount },
    inputEvidence: {
      invocation,
      persisted,
      auditPersisted: persistedEvent.details.provenance,
      persistedEventId: persistedEvent.eventId,
      auditEventId: persistedEvent.eventId,
      matchesPersisted,
      storeMatchesAudit: true,
    },
  };
}

/**
 * @param {Readonly<{ logicalOperationId: string, title: string, body: string }>} input
 * @param {{ channel: "WEBMCP" | "LOCAL_FORM", signal?: AbortSignal }} context
 */
export async function createOrReadDryRun(input, context) {
  context.signal?.throwIfAborted();
  const [intentId, payloadDigest] = await Promise.all([
    deriveIntentId(input.logicalOperationId),
    digestPayload(input),
  ]);
  context.signal?.throwIfAborted();
  const invocation = provenance(context.channel);

  return withLedgerLock(async () => {
    const existing = await getIntent(intentId);
    if (existing) {
      if (
        existing.logicalOperationId !== input.logicalOperationId
        || existing.title !== input.title
        || existing.body !== input.body
        || existing.target !== TARGET
        || existing.payloadDigest !== payloadDigest
      ) throw new TypeError("logical operation already exists with different notification content");
      const persistedEvent = await getEvent(existing.provenanceEventId);
      if (!persistedEvent || persistedEvent.hash !== existing.provenanceEventHash) {
        throw new TypeError("persisted provenance event is unavailable");
      }
      return dryRunEnvelope(existing, invocation, persistedEvent);
    }

    const now = Date.now();
    const eventId = createUuidV7(now);
    const baseIntent = {
      intentId,
      logicalOperationId: input.logicalOperationId,
      title: input.title,
      body: input.body,
      target: TARGET,
      payloadDigest,
      controlState: "DRY_RUN",
      effectState: "NOT_STARTED",
      effectStartCount: 0,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      auditHead: ZERO_HASH,
      provenanceEventId: eventId,
      provenanceEventHash: "",
    };
    const eventWithoutHash = {
      eventId,
      intentId,
      sequence: 1,
      kind: "intent-dry-run-created",
      occurredAt: now,
      fromControl: "DISCOVERED",
      toControl: "DRY_RUN",
      fromEffect: null,
      toEffect: "NOT_STARTED",
      effectStartCount: 0,
      previousHash: ZERO_HASH,
      details: { provenance: invocation, payloadDigest, target: TARGET },
    };
    const hash = await hashEvent(eventWithoutHash);
    const { intent, event } = await putAndReadBack(
      { ...baseIntent, auditHead: hash, provenanceEventHash: hash },
      { ...eventWithoutHash, hash },
    );
    context.signal?.throwIfAborted();
    return dryRunEnvelope(intent, invocation, event);
  });
}

/**
 * @param {string} intentId
 * @param {{ kind: string, toControl: string, toEffect: string, effectStartCount: number, details?: Record<string, unknown> }} change
 */
async function transition(intentId, change) {
  return withLedgerLock(async () => {
    const current = await getIntent(intentId);
    if (!current) throw new TypeError("notification intent does not exist");
    const mutation = await nextMutation(current, change);
    return putAndReadBack(mutation.intent, mutation.event);
  });
}

/** @param {string} intentId */
export function approveIntent(intentId) {
  return transition(intentId, {
    kind: "human-approved",
    toControl: "USER_APPROVED",
    toEffect: "NOT_STARTED",
    effectStartCount: 0,
    details: { approvalSurface: "VISIBLE_BUTTON" },
  });
}

/** @param {string} intentId @param {string} reason */
export function abortBeforeEffect(intentId, reason) {
  return transition(intentId, {
    kind: "stopped-before-effect",
    toControl: "ABORTED",
    toEffect: "NOT_STARTED",
    effectStartCount: 0,
    details: { reason },
  });
}

/** @param {string} intentId */
export function claimEffectStart(intentId) {
  return transition(intentId, {
    kind: "effect-start-claimed",
    toControl: "EXECUTING",
    toEffect: "AMBIGUOUS",
    effectStartCount: 1,
    details: { startStatus: "UNKNOWN" },
  });
}

/** @param {string} intentId */
export function confirmEffectPresent(intentId) {
  return transition(intentId, {
    kind: "effect-presence-confirmed",
    toControl: "VERIFIED",
    toEffect: "CONFIRMED_PRESENT",
    effectStartCount: 1,
    details: { readback: "SERVICE_WORKER_GET_NOTIFICATIONS" },
  });
}

/** @param {string} intentId */
export function suppressVerifiedDuplicate(intentId) {
  return transition(intentId, {
    kind: "duplicate-suppressed",
    toControl: "VERIFIED",
    toEffect: "CONFIRMED_PRESENT",
    effectStartCount: 1,
    details: { reason: "ALREADY_VERIFIED" },
  });
}
