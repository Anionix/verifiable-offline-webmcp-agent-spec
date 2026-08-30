// @ts-check
// information_uuid_v5=bf8ac35a-00a1-5b9b-aed3-d00c5a0e228d
// event_uuid_v7=0199651b-6952-7000-8000-000000000001
// state_transition=EMPTY -> PREPARED -> HUMAN_APPROVED -> COMMITTED -> RETRY_RECOGNIZED
// state_transition=PREPARED -> EXPIRED
// state_transition=EXPIRED -> PREPARED
// machine-contract: booking fingerprint, confirmation number, and event sequence
// are protected by IndexedDB unique constraints. A human approval must repeat
// the visible intent, fingerprint, and approval digest; HUMAN_APPROVED and
// COMMITTED then persist in one transaction, so a retry can observe but cannot
// repeat the simulated booking effect.
// information_uuid_v5=4d5c7c5c-98a2-5a34-8d40-d4a8f8d77f0e
// event_uuid_v7=01a050d2-0000-7000-8000-000000000189
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-30T20:00:00.000+09:00
// machine-contract: re-preparation preserves the semantic booking identity, records
// EXPIRED before PREPARED, and binds a fresh approval digest to the new time window.

import {
  APPROVAL_WINDOW_MILLISECONDS,
  BOOKING_FINGERPRINT_NAMESPACE,
  calculateBookingQuote,
  calculateCancellationPreview,
  createUuidV5,
  createUuidV7,
  deriveBookingFingerprint,
  digestCanonicalPayload,
  normalizeBookingInput,
  toEpochMilliseconds,
} from "./booking-domain.js";

export const HOTEL_BOOKING_DATABASE_NAME = "fictional-kyoto-hotel-booking-v1";
export const HOTEL_BOOKING_DATABASE_VERSION = 1;
export const HOTEL_BOOKING_STATES = Object.freeze([
  "EMPTY",
  "PREPARED",
  "HUMAN_APPROVED",
  "COMMITTED",
  "RETRY_RECOGNIZED",
  "EXPIRED",
]);

const INTENTS = "intents";
const BOOKINGS = "bookings";
const EVENTS = "events";
const ZERO_HASH = "0".repeat(64);
const MAX_OPTIMISTIC_RETRIES = 5;

/** @typedef {import("./booking-domain.js").HotelBookingValidationError} HotelBookingValidationError */

/** @param {IDBRequest} request */
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB request failed")), { once: true });
  });
}

/** @param {IDBTransaction} transaction */
function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(undefined), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error ?? new Error("IndexedDB transaction aborted")), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error ?? new Error("IndexedDB transaction failed")), { once: true });
  });
}

/** @param {unknown} error */
function isConstraintError(error) {
  return error instanceof Error && error.name === "ConstraintError";
}

/**
 * @param {{ indexedDB?: IDBFactory, databaseName?: string }} [options]
 * @returns {Promise<IDBDatabase>}
 */
export function openHotelBookingDatabase(options = {}) {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory || typeof factory.open !== "function") {
    return Promise.reject(new TypeError("IndexedDB is unavailable"));
  }
  const databaseName = options.databaseName ?? HOTEL_BOOKING_DATABASE_NAME;
  return new Promise((resolve, reject) => {
    const request = factory.open(databaseName, HOTEL_BOOKING_DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      const database = request.result;
      const intents = database.createObjectStore(INTENTS, { keyPath: "intentId" });
      intents.createIndex("byFingerprint", "fingerprint", { unique: true });

      const bookings = database.createObjectStore(BOOKINGS, { keyPath: "bookingId" });
      bookings.createIndex("byFingerprint", "fingerprint", { unique: true });
      bookings.createIndex("byConfirmationNumber", "confirmationNumber", { unique: true });

      const events = database.createObjectStore(EVENTS, { keyPath: "eventId" });
      events.createIndex("byIntentSequence", ["intentId", "sequence"], { unique: true });
      events.createIndex("byIntentId", "intentId", { unique: false });
    }, { once: true });
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB open failed")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("IndexedDB upgrade was blocked")), { once: true });
  });
}

/** @param {{ indexedDB?: IDBFactory, databaseName?: string }} [options] */
export function resetHotelBookingDatabase(options = {}) {
  const factory = options.indexedDB ?? globalThis.indexedDB;
  if (!factory || typeof factory.deleteDatabase !== "function") {
    return Promise.reject(new TypeError("IndexedDB is unavailable"));
  }
  const databaseName = options.databaseName ?? HOTEL_BOOKING_DATABASE_NAME;
  return new Promise((resolve, reject) => {
    const request = factory.deleteDatabase(databaseName);
    request.addEventListener("success", () => resolve(undefined), { once: true });
    request.addEventListener("error", () => reject(request.error ?? new Error("IndexedDB delete failed")), { once: true });
    request.addEventListener("blocked", () => reject(new Error("IndexedDB delete was blocked")), { once: true });
  });
}

/** @param {Record<string, any>} options */
function optionTime(options) {
  return toEpochMilliseconds(options.now ?? Date.now());
}

/** @param {Record<string, any>} options @param {number} now */
function nextEventId(options, now) {
  return typeof options.uuidV7Factory === "function"
    ? options.uuidV7Factory(now)
    : createUuidV7(now);
}

/** @param {Record<string, any>} options */
async function acquireDatabase(options) {
  if (options.database) return { database: options.database, owned: false };
  const database = await openHotelBookingDatabase(options);
  return { database, owned: true };
}

/** @param {{ database: IDBDatabase, owned: boolean }} lease */
function releaseDatabase(lease) {
  if (lease.owned) lease.database.close();
}

/** @param {IDBObjectStore} store @param {{ kind: "intentId" | "fingerprint", value: string }} identity */
async function readIntentFromStore(store, identity) {
  if (identity.kind === "fingerprint") {
    return requestResult(store.index("byFingerprint").get(identity.value));
  }
  const direct = await requestResult(store.get(identity.value));
  if (direct) return direct;
  return requestResult(store.index("byFingerprint").get(identity.value));
}

/** @param {IDBDatabase} database @param {{ kind: "intentId" | "fingerprint", value: string }} identity */
async function readIntent(database, identity) {
  const transaction = database.transaction(INTENTS, "readonly");
  const completion = transactionCompletion(transaction);
  const result = await readIntentFromStore(transaction.objectStore(INTENTS), identity);
  await completion;
  return /** @type {Record<string, any> | undefined} */ (result);
}

/** @param {unknown} reference */
async function resolveIdentity(reference) {
  if (typeof reference === "string") {
    return { identity: { kind: /** @type {const} */ ("intentId"), value: reference }, input: null };
  }
  const input = normalizeBookingInput(reference);
  const fingerprint = await deriveBookingFingerprint(input);
  return { identity: { kind: /** @type {const} */ ("fingerprint"), value: fingerprint }, input };
}

/** @param {Record<string, any>} intent @param {number} now */
function presentIntent(intent, now) {
  const approvalExpired = intent.state === "PREPARED" && now >= Date.parse(intent.approvalExpiresAt);
  return {
    exists: true,
    bookingExists: intent.state === "COMMITTED" || intent.state === "RETRY_RECOGNIZED",
    intentId: intent.intentId,
    fingerprint: intent.fingerprint,
    state: approvalExpired ? "EXPIRED" : intent.state,
    confirmationNumber: intent.confirmationNumber ?? null,
    bookingId: intent.bookingId ?? null,
    attemptCount: intent.attemptCount,
    effectStartCount: intent.effectStartCount,
    preparedAt: intent.preparedAt,
    approvalExpiresAt: intent.approvalExpiresAt,
    approvalExpired,
    quote: intent.quote,
    cancellationPreview: calculateCancellationPreview(intent.normalizedInput, now),
    normalizedInput: intent.normalizedInput,
    approvalPayloadDigest: intent.approvalPayloadDigest,
    eventCount: intent.eventCount,
    eventChainHead: intent.headHash,
    scope: "THIS_DEVICE_AND_THIS_DEPLOYMENT_ONLY",
  };
}

/**
 * The approval digest binds the visible terms to one preparation window. This
 * makes an expired preparation's digest unusable after a fresh preparation,
 * even though the semantic booking fingerprint remains stable.
 *
 * @param {Record<string, any>} input
 * @param {Record<string, any>} quote
 * @param {string} preparedAt
 * @param {string} approvalExpiresAt
 */
function approvalPayload(input, quote, preparedAt, approvalExpiresAt) {
  return {
    booking: {
      adults: input.adults,
      checkInDate: input.checkInDate,
      checkOutDate: input.checkOutDate,
      hotelId: input.hotelId,
      roomPlanId: input.roomPlanId,
      rooms: input.rooms,
    },
    quote,
    preparedAt,
    approvalExpiresAt,
  };
}

/**
 * Persist the time-driven PREPARED -> EXPIRED transition without starting a
 * booking effect. This browser housekeeping function is intentionally absent
 * from the WebMCP adapter.
 *
 * @param {unknown} reference
 * @param {Record<string, any>} [options]
 */
export async function expireHotelBookingPreparation(reference, options = {}) {
  const { identity } = await resolveIdentity(reference);
  const now = optionTime(options);
  const occurredAt = new Date(now).toISOString();
  const lease = await acquireDatabase(options);
  try {
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt += 1) {
      const snapshot = await readIntent(lease.database, identity);
      if (!snapshot) return presentEmpty(null, identity.kind === "fingerprint" ? identity.value : null, now);
      if (snapshot.state !== "PREPARED") return presentIntent(snapshot, now);
      if (now < Date.parse(snapshot.approvalExpiresAt)) return presentIntent(snapshot, now);

      const event = await buildEvent({
        eventId: nextEventId(options, now),
        intentId: snapshot.intentId,
        sequence: snapshot.eventCount + 1,
        occurredAt,
        fromState: "PREPARED",
        toState: "EXPIRED",
        previousEventHash: snapshot.headHash,
        payload: { approvalExpiresAt: snapshot.approvalExpiresAt, expiredAt: occurredAt },
      });
      const proposed = {
        ...snapshot,
        state: "EXPIRED",
        expiredAt: occurredAt,
        eventCount: snapshot.eventCount + 1,
        headHash: event.eventHash,
        version: snapshot.version + 1,
      };
      const transaction = lease.database.transaction([INTENTS, EVENTS], "readwrite");
      const completion = transactionCompletion(transaction);
      const intents = transaction.objectStore(INTENTS);
      const current = /** @type {Record<string, any> | undefined} */ (await readIntentFromStore(intents, identity));
      if (!current || current.version !== snapshot.version || current.headHash !== snapshot.headHash) {
        transaction.abort();
        await completion.catch(() => undefined);
        continue;
      }
      try {
        await requestResult(intents.put(proposed));
        await requestResult(transaction.objectStore(EVENTS).add(event));
        await completion;
        return presentIntent(proposed, now);
      } catch (error) {
        await completion.catch(() => undefined);
        if (!isConstraintError(error)) throw error;
      }
    }
    const converged = await readIntent(lease.database, identity);
    if (converged?.state === "EXPIRED") return presentIntent(converged, now);
    throw new Error("booking expiration did not converge after concurrent updates");
  } finally {
    releaseDatabase(lease);
  }
}

/** @param {ReturnType<typeof normalizeBookingInput> | null} input @param {string | null} fingerprint @param {number} now */
function presentEmpty(input, fingerprint, now) {
  return {
    exists: false,
    bookingExists: false,
    intentId: null,
    fingerprint,
    state: "EMPTY",
    confirmationNumber: null,
    bookingId: null,
    attemptCount: 0,
    effectStartCount: 0,
    preparedAt: null,
    approvalExpiresAt: null,
    approvalExpired: false,
    quote: input ? calculateBookingQuote(input) : null,
    cancellationPreview: input ? calculateCancellationPreview(input, now) : null,
    normalizedInput: input,
    approvalPayloadDigest: null,
    eventCount: 0,
    eventChainHead: ZERO_HASH,
    scope: "THIS_DEVICE_AND_THIS_DEPLOYMENT_ONLY",
  };
}

/**
 * @param {{ intentId: string, sequence: number, fromState: string, toState: string, occurredAt: string, previousEventHash: string, eventId: string, payload: Record<string, unknown> }} source
 */
async function buildEvent(source) {
  const payloadDigest = await digestCanonicalPayload(source.payload);
  const envelope = {
    eventId: source.eventId,
    informationId: source.intentId,
    intentId: source.intentId,
    sequence: source.sequence,
    occurredAt: source.occurredAt,
    fromState: source.fromState,
    toState: source.toState,
    payloadDigest,
    previousEventHash: source.previousEventHash,
  };
  return { ...envelope, eventHash: await digestCanonicalPayload(envelope) };
}

/** @param {Record<string, any>} event */
async function eventHashIsValid(event) {
  const envelope = {
    eventId: event.eventId,
    informationId: event.informationId,
    intentId: event.intentId,
    sequence: event.sequence,
    occurredAt: event.occurredAt,
    fromState: event.fromState,
    toState: event.toState,
    payloadDigest: event.payloadDigest,
    previousEventHash: event.previousEventHash,
  };
  return await digestCanonicalPayload(envelope) === event.eventHash;
}

/**
 * Idempotently create a PREPARED intent. The unique fingerprint index is the
 * final arbiter when two tabs prepare the same reservation concurrently.
 *
 * @param {unknown} value
 * @param {Record<string, any>} [options]
 */
export async function prepareHotelBooking(value, options = {}) {
  const normalizedInput = normalizeBookingInput(value);
  const fingerprint = await deriveBookingFingerprint(normalizedInput);
  const intentId = fingerprint;
  const now = optionTime(options);
  const preparedAt = new Date(now).toISOString();
  const approvalExpiresAt = new Date(now + APPROVAL_WINDOW_MILLISECONDS).toISOString();
  const quote = calculateBookingQuote(normalizedInput);
  const approvalPayloadDigest = await digestCanonicalPayload(
    approvalPayload(normalizedInput, quote, preparedAt, approvalExpiresAt),
  );

  const lease = await acquireDatabase(options);
  try {
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt += 1) {
      const readTransaction = lease.database.transaction(INTENTS, "readonly");
      const readCompletion = transactionCompletion(readTransaction);
      const existing = /** @type {Record<string, any> | undefined} */ (
        await requestResult(readTransaction.objectStore(INTENTS).index("byFingerprint").get(fingerprint))
      );
      await readCompletion;

      if (existing) {
        if (existing.state === "PREPARED" && now >= Date.parse(existing.approvalExpiresAt)) {
          await expireHotelBookingPreparation(existing.intentId, { ...options, database: lease.database });
          continue;
        }
        if (existing.state !== "EXPIRED") return { ...presentIntent(existing, now), created: false };

        const event = await buildEvent({
          eventId: nextEventId(options, now),
          intentId: existing.intentId,
          sequence: existing.eventCount + 1,
          occurredAt: preparedAt,
          fromState: "EXPIRED",
          toState: "PREPARED",
          previousEventHash: existing.headHash,
          payload: {
            approvalExpiresAt,
            approvalPayloadDigest,
            fingerprint,
            preparedAt,
          },
        });
        const proposed = {
          ...existing,
          state: "PREPARED",
          preparedAt,
          approvalExpiresAt,
          approvalPayloadDigest,
          quote,
          eventCount: existing.eventCount + 1,
          headHash: event.eventHash,
          version: existing.version + 1,
          expiredAt: null,
        };
        const transaction = lease.database.transaction([INTENTS, EVENTS], "readwrite");
        const completion = transactionCompletion(transaction);
        const intents = transaction.objectStore(INTENTS);
        const current = /** @type {Record<string, any> | undefined} */ (
          await readIntentFromStore(intents, { kind: "fingerprint", value: fingerprint })
        );
        if (
          !current
          || current.version !== existing.version
          || current.headHash !== existing.headHash
          || current.state !== "EXPIRED"
        ) {
          transaction.abort();
          await completion.catch(() => undefined);
          continue;
        }
        try {
          await requestResult(intents.put(proposed));
          await requestResult(transaction.objectStore(EVENTS).add(event));
          await completion;
          return { ...presentIntent(proposed, now), created: true };
        } catch (error) {
          await completion.catch(() => undefined);
          if (!isConstraintError(error)) throw error;
          continue;
        }
      }

      const event = await buildEvent({
        eventId: nextEventId(options, now),
        intentId,
        sequence: 1,
        occurredAt: preparedAt,
        fromState: "EMPTY",
        toState: "PREPARED",
        previousEventHash: ZERO_HASH,
        payload: { approvalExpiresAt, approvalPayloadDigest, fingerprint, preparedAt },
      });
      const proposed = {
        intentId,
        fingerprint,
        normalizedInput,
        state: "PREPARED",
        preparedAt,
        approvalExpiresAt,
        approvalPayloadDigest,
        attemptCount: 1,
        effectStartCount: 0,
        bookingId: null,
        confirmationNumber: null,
        quote,
        eventCount: 1,
        headHash: event.eventHash,
        version: 1,
      };
      const transaction = lease.database.transaction([INTENTS, EVENTS], "readwrite");
      const completion = transactionCompletion(transaction);
      const intents = transaction.objectStore(INTENTS);
      try {
        await requestResult(intents.add(proposed));
        await requestResult(transaction.objectStore(EVENTS).add(event));
        await completion;
        return { ...presentIntent(proposed, now), created: true };
      } catch (error) {
        await completion.catch(() => undefined);
        if (!isConstraintError(error)) throw error;
      }
    }
    const converged = await readIntent(lease.database, { kind: "fingerprint", value: fingerprint });
    if (converged) return { ...presentIntent(converged, now), created: false };
    throw new Error("hotel booking preparation did not converge after concurrent updates");
  } finally {
    releaseDatabase(lease);
  }
}

/**
 * @param {unknown} reference
 * @param {Record<string, any>} [options]
 */
export async function getHotelBookingStatus(reference, options = {}) {
  const { identity, input } = await resolveIdentity(reference);
  const now = optionTime(options);
  const lease = await acquireDatabase(options);
  try {
    const intent = await readIntent(lease.database, identity);
    const fingerprint = identity.kind === "fingerprint" ? identity.value : null;
    return intent ? presentIntent(intent, now) : presentEmpty(input, fingerprint, now);
  } finally {
    releaseDatabase(lease);
  }
}

/**
 * @param {unknown} value
 * @param {Record<string, any>} [options]
 */
export async function checkExistingHotelBooking(value, options = {}) {
  return getHotelBookingStatus(value, options);
}

/** @param {Record<string, any>} snapshot */
async function currentApproval(snapshot) {
  const quote = calculateBookingQuote(snapshot.normalizedInput);
  const approvalPayloadDigest = await digestCanonicalPayload(
    approvalPayload(snapshot.normalizedInput, quote, snapshot.preparedAt, snapshot.approvalExpiresAt),
  );
  return { approvalPayloadDigest, quote };
}

/** @param {Record<string, any>} snapshot @param {Record<string, any>} options */
function requireExpectedVisibleApproval(snapshot, options) {
  const expectations = [
    ["expectedIntentId", snapshot.intentId],
    ["expectedFingerprint", snapshot.fingerprint],
    ["expectedApprovalPayloadDigest", snapshot.approvalPayloadDigest],
  ];
  for (const [name, actual] of expectations) {
    if (options[name] === undefined) continue;
    if (typeof options[name] !== "string" || options[name] !== actual) {
      throw new Error("visible booking details or price no longer match the prepared approval");
    }
  }
}

/**
 * Human-only action. WebMCP never imports or receives this function. Approval
 * and the single simulated effect start commit atomically with both events.
 *
 * @param {unknown} reference
 * @param {Record<string, any>} [options]
 */
export async function humanApproveAndCommit(reference, options = {}) {
  const { identity } = await resolveIdentity(reference);
  const now = optionTime(options);
  const occurredAt = new Date(now).toISOString();
  const lease = await acquireDatabase(options);
  try {
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt += 1) {
      const snapshot = await readIntent(lease.database, identity);
      if (!snapshot) throw new Error("booking intent must be prepared before human approval");
      requireExpectedVisibleApproval(snapshot, options);
      if (["COMMITTED", "RETRY_RECOGNIZED", "EXPIRED"].includes(snapshot.state)) {
        return presentIntent(snapshot, now);
      }
      if (snapshot.state !== "PREPARED") throw new Error(`cannot approve booking from ${snapshot.state}`);
      const currentApprovalContract = await currentApproval(snapshot);
      if (
        currentApprovalContract.approvalPayloadDigest !== snapshot.approvalPayloadDigest
        || await digestCanonicalPayload(currentApprovalContract.quote) !== await digestCanonicalPayload(snapshot.quote)
      ) {
        throw new Error("prepared booking content or price no longer matches the current approval contract");
      }

      const hasExpired = now >= Date.parse(snapshot.approvalExpiresAt);
      const firstEvent = await buildEvent({
        eventId: nextEventId(options, now),
        intentId: snapshot.intentId,
        sequence: snapshot.eventCount + 1,
        occurredAt,
        fromState: "PREPARED",
        toState: hasExpired ? "EXPIRED" : "HUMAN_APPROVED",
        previousEventHash: snapshot.headHash,
        payload: hasExpired
          ? { approvalExpiresAt: snapshot.approvalExpiresAt, rejectedAt: occurredAt }
          : { approvalPayloadDigest: snapshot.approvalPayloadDigest, approvedAt: occurredAt },
      });

      let secondEvent = null;
      let booking = null;
      let proposed;
      if (hasExpired) {
        proposed = {
          ...snapshot,
          state: "EXPIRED",
          eventCount: snapshot.eventCount + 1,
          headHash: firstEvent.eventHash,
          expiredAt: occurredAt,
          version: snapshot.version + 1,
        };
      } else {
        const bookingId = await createUuidV5(
          BOOKING_FINGERPRINT_NAMESPACE,
          `fictional-booking:v1:${snapshot.fingerprint}`,
        );
        const confirmationNumber = `FKR-${bookingId.replaceAll("-", "").slice(0, 10).toUpperCase()}`;
        secondEvent = await buildEvent({
          eventId: nextEventId(options, now),
          intentId: snapshot.intentId,
          sequence: snapshot.eventCount + 2,
          occurredAt,
          fromState: "HUMAN_APPROVED",
          toState: "COMMITTED",
          previousEventHash: firstEvent.eventHash,
          payload: {
            approvalPayloadDigest: snapshot.approvalPayloadDigest,
            bookingId,
            confirmationNumber,
            effectStartCount: 1,
          },
        });
        booking = {
          bookingId,
          intentId: snapshot.intentId,
          fingerprint: snapshot.fingerprint,
          confirmationNumber,
          normalizedInput: snapshot.normalizedInput,
          quote: snapshot.quote,
          committedAt: occurredAt,
          effectStartCount: 1,
        };
        proposed = {
          ...snapshot,
          state: "COMMITTED",
          bookingId,
          confirmationNumber,
          humanApprovedAt: occurredAt,
          committedAt: occurredAt,
          effectStartCount: 1,
          eventCount: snapshot.eventCount + 2,
          headHash: secondEvent.eventHash,
          version: snapshot.version + 1,
        };
      }

      const transaction = lease.database.transaction([INTENTS, BOOKINGS, EVENTS], "readwrite");
      const completion = transactionCompletion(transaction);
      const intents = transaction.objectStore(INTENTS);
      const current = /** @type {Record<string, any> | undefined} */ (await readIntentFromStore(intents, identity));
      if (!current || current.version !== snapshot.version || current.headHash !== snapshot.headHash) {
        transaction.abort();
        await completion.catch(() => undefined);
        continue;
      }
      try {
        await requestResult(intents.put(proposed));
        await requestResult(transaction.objectStore(EVENTS).add(firstEvent));
        if (secondEvent && booking) {
          await requestResult(transaction.objectStore(EVENTS).add(secondEvent));
          await requestResult(transaction.objectStore(BOOKINGS).add(booking));
        }
        await completion;
        return presentIntent(proposed, now);
      } catch (error) {
        await completion.catch(() => undefined);
        if (!isConstraintError(error)) throw error;
      }
    }
    const converged = await readIntent(lease.database, identity);
    if (converged && ["COMMITTED", "RETRY_RECOGNIZED", "EXPIRED"].includes(converged.state)) {
      return presentIntent(converged, now);
    }
    throw new Error("booking approval did not converge after concurrent updates");
  } finally {
    releaseDatabase(lease);
  }
}

/**
 * Record one lost-response retry. Repeated button presses remain idempotent:
 * attemptCount reaches 2 once while effectStartCount remains exactly 1.
 *
 * @param {unknown} reference
 * @param {Record<string, any>} [options]
 */
export async function recognizeHotelBookingRetry(reference, options = {}) {
  const { identity } = await resolveIdentity(reference);
  const now = optionTime(options);
  const occurredAt = new Date(now).toISOString();
  const lease = await acquireDatabase(options);
  try {
    for (let attempt = 0; attempt < MAX_OPTIMISTIC_RETRIES; attempt += 1) {
      const snapshot = await readIntent(lease.database, identity);
      if (!snapshot) throw new Error("booking intent does not exist");
      if (snapshot.state === "RETRY_RECOGNIZED") return presentIntent(snapshot, now);
      if (snapshot.state !== "COMMITTED") throw new Error(`retry can only follow COMMITTED, not ${snapshot.state}`);
      const event = await buildEvent({
        eventId: nextEventId(options, now),
        intentId: snapshot.intentId,
        sequence: snapshot.eventCount + 1,
        occurredAt,
        fromState: "COMMITTED",
        toState: "RETRY_RECOGNIZED",
        previousEventHash: snapshot.headHash,
        payload: {
          attemptCount: 2,
          confirmationNumber: snapshot.confirmationNumber,
          effectStartCount: 1,
        },
      });
      const proposed = {
        ...snapshot,
        state: "RETRY_RECOGNIZED",
        attemptCount: 2,
        effectStartCount: 1,
        retryRecognizedAt: occurredAt,
        eventCount: snapshot.eventCount + 1,
        headHash: event.eventHash,
        version: snapshot.version + 1,
      };
      const transaction = lease.database.transaction([INTENTS, EVENTS], "readwrite");
      const completion = transactionCompletion(transaction);
      const intents = transaction.objectStore(INTENTS);
      const current = /** @type {Record<string, any> | undefined} */ (await readIntentFromStore(intents, identity));
      if (!current || current.version !== snapshot.version || current.headHash !== snapshot.headHash) {
        transaction.abort();
        await completion.catch(() => undefined);
        continue;
      }
      try {
        await requestResult(intents.put(proposed));
        await requestResult(transaction.objectStore(EVENTS).add(event));
        await completion;
        return presentIntent(proposed, now);
      } catch (error) {
        await completion.catch(() => undefined);
        if (!isConstraintError(error)) throw error;
      }
    }
    const converged = await readIntent(lease.database, identity);
    if (converged?.state === "RETRY_RECOGNIZED") return presentIntent(converged, now);
    throw new Error("booking retry recognition did not converge after concurrent updates");
  } finally {
    releaseDatabase(lease);
  }
}

/**
 * Pure preview across the persistence boundary; no store is opened or changed.
 *
 * @param {unknown} value
 * @param {Record<string, any>} [options]
 */
export async function previewHotelCancellation(value, options = {}) {
  const input = normalizeBookingInput(value);
  const now = optionTime(options);
  const status = await getHotelBookingStatus(input, options);
  return {
    ...status,
    cancellationPreview: calculateCancellationPreview(input, now),
    stateChanged: false,
  };
}

/**
 * @param {unknown} reference
 * @param {Record<string, any>} [options]
 */
export async function listHotelBookingEvents(reference, options = {}) {
  const { identity } = await resolveIdentity(reference);
  const lease = await acquireDatabase(options);
  try {
    // machine-contract: intent head/count and its events share one IndexedDB
    // snapshot. A second tab may write before or after this transaction, but it
    // cannot make a healthy chain look corrupt by advancing between two reads.
    const transaction = lease.database.transaction([INTENTS, EVENTS], "readonly");
    const completion = transactionCompletion(transaction);
    const intent = /** @type {Record<string, any> | undefined} */ (
      await readIntentFromStore(transaction.objectStore(INTENTS), identity)
    );
    if (!intent) {
      await completion;
      return { intentId: null, fingerprint: identity.value, chainValid: true, events: [] };
    }
    const raw = /** @type {Array<Record<string, any>>} */ (
      await requestResult(transaction.objectStore(EVENTS).index("byIntentId").getAll(intent.intentId))
    );
    await completion;
    const events = raw.sort((left, right) => left.sequence - right.sequence);
    let previous = ZERO_HASH;
    let chainValid = true;
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      if (
        event.sequence !== index + 1
        || event.previousEventHash !== previous
        || !(await eventHashIsValid(event))
      ) chainValid = false;
      previous = event.eventHash;
    }
    if (events.length !== intent.eventCount || previous !== intent.headHash) chainValid = false;
    return { intentId: intent.intentId, fingerprint: intent.fingerprint, chainValid, events };
  } finally {
    releaseDatabase(lease);
  }
}
