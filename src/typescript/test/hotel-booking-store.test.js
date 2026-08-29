// information_uuid_v5=bf8ac35a-00a1-5b9b-aed3-d00c5a0e228d
// event_uuid_v7=0199651b-6955-7000-8000-000000000001
// machine-contract: simultaneous tabs and repeated human clicks converge to one booking and one effect start.
import assert from "node:assert/strict";
import test from "node:test";
import { indexedDB } from "fake-indexeddb";
import {
  checkExistingHotelBooking,
  expireHotelBookingPreparation,
  getHotelBookingStatus,
  humanApproveAndCommit,
  listHotelBookingEvents,
  openHotelBookingDatabase,
  prepareHotelBooking,
  previewHotelCancellation,
  recognizeHotelBookingRetry,
  resetHotelBookingDatabase,
} from "../hotel/browser-store.js";
import { digestCanonicalPayload } from "../hotel/booking-domain.js";

const BASE = Object.freeze({
  hotelId: "fictional-kyoto-ryokan",
  roomPlanId: "standard-flexible",
  checkInDate: "2026-10-10",
  checkOutDate: "2026-10-13",
  adults: 2,
  rooms: 1,
  preferredLanguage: "en",
});
const PREPARED_AT = "2026-08-29T01:00:00.000Z";

function databaseOptions(testName, now = PREPARED_AT) {
  return { indexedDB, databaseName: `hotel-test-${testName}`, now };
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });
}

function transactionCompletion(transaction) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(undefined), { once: true });
    transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
    transaction.addEventListener("error", () => reject(transaction.error), { once: true });
  });
}

test("two tabs, language changes, reload, and repeated preparation keep one intent", async () => {
  const options = databaseOptions("two-tabs");
  await resetHotelBookingDatabase(options);
  const [databaseA, databaseB] = await Promise.all([
    openHotelBookingDatabase(options),
    openHotelBookingDatabase(options),
  ]);
  try {
    const [first, second, third] = await Promise.all([
      prepareHotelBooking(BASE, { ...options, database: databaseA }),
      prepareHotelBooking({ ...BASE, preferredLanguage: "ja" }, { ...options, database: databaseB }),
      prepareHotelBooking(BASE, { ...options, database: databaseA }),
    ]);
    assert.equal(new Set([first.intentId, second.intentId, third.intentId]).size, 1);
    assert.equal([first, second, third].filter((result) => result.created).length, 1);
    assert.equal(first.state, "PREPARED");
    assert.equal(first.eventCount, 1);
    const history = await listHotelBookingEvents(BASE, { ...options, database: databaseB });
    assert.equal(history.chainValid, true);
    assert.deepEqual(history.events.map((event) => `${event.fromState}->${event.toState}`), ["EMPTY->PREPARED"]);
  } finally {
    databaseA.close();
    databaseB.close();
  }

  const afterReload = await getHotelBookingStatus(BASE, options);
  assert.equal(afterReload.exists, true);
  assert.equal(afterReload.eventCount, 1);
  await resetHotelBookingDatabase(options);
});

test("audit history reads the intent head and events from one database snapshot", async () => {
  const options = databaseOptions("audit-snapshot");
  await resetHotelBookingDatabase(options);
  await prepareHotelBooking(BASE, options);
  const database = await openHotelBookingDatabase(options);
  const observedScopes = [];
  const instrumentedDatabase = {
    transaction(storeNames, mode) {
      observedScopes.push({ storeNames: Array.isArray(storeNames) ? [...storeNames] : [storeNames], mode });
      return database.transaction(storeNames, mode);
    },
  };
  try {
    const history = await listHotelBookingEvents(BASE, { ...options, database: instrumentedDatabase });
    assert.equal(history.chainValid, true);
    assert.deepEqual(observedScopes, [{ storeNames: ["intents", "events"], mode: "readonly" }]);
  } finally {
    database.close();
  }
  await resetHotelBookingDatabase(options);
});

test("double approval and retry converge to one booking, one confirmation, and one effect", async () => {
  const options = databaseOptions("approval-race");
  await resetHotelBookingDatabase(options);
  await prepareHotelBooking(BASE, options);
  const [databaseA, databaseB] = await Promise.all([
    openHotelBookingDatabase(options),
    openHotelBookingDatabase(options),
  ]);
  let approvals;
  let retries;
  try {
    approvals = await Promise.all([
      humanApproveAndCommit(BASE, { ...options, database: databaseA, now: "2026-08-29T01:01:00.000Z" }),
      humanApproveAndCommit(BASE, { ...options, database: databaseB, now: "2026-08-29T01:01:00.000Z" }),
    ]);
    retries = await Promise.all([
      recognizeHotelBookingRetry(BASE, { ...options, database: databaseA, now: "2026-08-29T01:01:05.000Z" }),
      recognizeHotelBookingRetry(BASE, { ...options, database: databaseB, now: "2026-08-29T01:01:05.000Z" }),
      recognizeHotelBookingRetry(BASE, { ...options, database: databaseA, now: "2026-08-29T01:01:05.000Z" }),
    ]);
  } finally {
    databaseA.close();
    databaseB.close();
  }

  assert.equal(new Set(approvals.map((result) => result.confirmationNumber)).size, 1);
  assert.ok(approvals.every((result) => result.effectStartCount === 1));
  assert.ok(retries.every((result) => result.state === "RETRY_RECOGNIZED"));
  assert.ok(retries.every((result) => result.attemptCount === 2));
  assert.ok(retries.every((result) => result.effectStartCount === 1));

  const status = await checkExistingHotelBooking({ ...BASE, preferredLanguage: "ja" }, options);
  assert.equal(status.bookingExists, true);
  assert.equal(status.attemptCount, 2);
  assert.equal(status.effectStartCount, 1);
  assert.equal(status.confirmationNumber, approvals[0].confirmationNumber);

  const countDatabase = await openHotelBookingDatabase(options);
  try {
    const transaction = countDatabase.transaction("bookings", "readonly");
    const completion = transactionCompletion(transaction);
    assert.equal(await requestResult(transaction.objectStore("bookings").count()), 1);
    await completion;
  } finally {
    countDatabase.close();
  }

  const history = await listHotelBookingEvents(BASE, options);
  assert.equal(history.chainValid, true);
  assert.deepEqual(history.events.map((event) => event.toState), [
    "PREPARED",
    "HUMAN_APPROVED",
    "COMMITTED",
    "RETRY_RECOGNIZED",
  ]);
  assert.ok(history.events.every((event) => /^[0-9a-f-]{36}$/u.test(event.eventId)));
  assert.ok(history.events.every((event) => /^[0-9a-f]{64}$/u.test(event.eventHash)));
  assert.equal(new Set(history.events.map((event) => event.eventId)).size, 4);
  await resetHotelBookingDatabase(options);
});

test("approval at 120 seconds expires without a booking effect", async () => {
  const options = databaseOptions("expiry");
  await resetHotelBookingDatabase(options);
  const prepared = await prepareHotelBooking(BASE, options);
  assert.equal(prepared.approvalExpiresAt, "2026-08-29T01:02:00.000Z");
  const readOnlyStatus = await getHotelBookingStatus(BASE, { ...options, now: "2026-08-29T01:02:00.000Z" });
  assert.equal(readOnlyStatus.state, "EXPIRED");
  assert.equal(readOnlyStatus.approvalExpired, true);
  assert.equal(readOnlyStatus.eventCount, 1);

  const expired = await expireHotelBookingPreparation(BASE, {
    ...options,
    now: "2026-08-29T01:02:00.000Z",
  });
  assert.equal(expired.state, "EXPIRED");
  assert.equal(expired.bookingExists, false);
  assert.equal(expired.confirmationNumber, null);
  assert.equal(expired.effectStartCount, 0);
  assert.equal(expired.eventCount, 2);
  const repeatedPreparation = await prepareHotelBooking(BASE, {
    ...options,
    now: "2026-08-29T01:02:01.000Z",
  });
  assert.equal(repeatedPreparation.state, "EXPIRED");
  assert.equal(repeatedPreparation.created, false);
  assert.equal(repeatedPreparation.eventCount, 2);
  const history = await listHotelBookingEvents(BASE, options);
  assert.equal(history.chainValid, true);
  assert.deepEqual(history.events.map((event) => event.toState), ["PREPARED", "EXPIRED"]);
  await resetHotelBookingDatabase(options);
});

test("human approval rejects a stale visible binding after booking details change", async () => {
  const options = databaseOptions("stale-visible-approval");
  const changed = { ...BASE, checkOutDate: "2026-10-14" };
  await resetHotelBookingDatabase(options);
  const first = await prepareHotelBooking(BASE, options);
  await prepareHotelBooking(changed, options);

  await assert.rejects(
    humanApproveAndCommit(changed, {
      ...options,
      now: "2026-08-29T01:01:00.000Z",
      expectedIntentId: first.intentId,
      expectedFingerprint: first.fingerprint,
      expectedApprovalPayloadDigest: first.approvalPayloadDigest,
    }),
    /visible booking details or price no longer match/u,
  );

  const firstAfter = await getHotelBookingStatus(BASE, options);
  const secondAfter = await getHotelBookingStatus(changed, options);
  assert.equal(firstAfter.state, "PREPARED");
  assert.equal(secondAfter.state, "PREPARED");
  assert.equal(firstAfter.effectStartCount, 0);
  assert.equal(secondAfter.effectStartCount, 0);
  await resetHotelBookingDatabase(options);
});

test("human approval rejects a stored price and digest that differ from the current price rule", async () => {
  const options = databaseOptions("changed-price-rule");
  await resetHotelBookingDatabase(options);
  const prepared = await prepareHotelBooking(BASE, options);
  const forgedQuote = {
    ...prepared.quote,
    unitPriceJpy: 13_000,
    totalPriceJpy: 39_000,
  };
  const forgedDigest = await digestCanonicalPayload({
    booking: {
      adults: prepared.normalizedInput.adults,
      checkInDate: prepared.normalizedInput.checkInDate,
      checkOutDate: prepared.normalizedInput.checkOutDate,
      hotelId: prepared.normalizedInput.hotelId,
      roomPlanId: prepared.normalizedInput.roomPlanId,
      rooms: prepared.normalizedInput.rooms,
    },
    quote: forgedQuote,
  });
  const database = await openHotelBookingDatabase(options);
  try {
    const transaction = database.transaction("intents", "readwrite");
    const completion = transactionCompletion(transaction);
    const intents = transaction.objectStore("intents");
    const snapshot = await requestResult(intents.get(prepared.intentId));
    snapshot.quote = forgedQuote;
    snapshot.approvalPayloadDigest = forgedDigest;
    await requestResult(intents.put(snapshot));
    await completion;
  } finally {
    database.close();
  }

  await assert.rejects(
    humanApproveAndCommit(BASE, {
      ...options,
      now: "2026-08-29T01:01:00.000Z",
      expectedIntentId: prepared.intentId,
      expectedFingerprint: prepared.fingerprint,
      expectedApprovalPayloadDigest: forgedDigest,
    }),
    /price no longer matches the current approval contract/u,
  );
  const status = await getHotelBookingStatus(BASE, options);
  assert.equal(status.bookingExists, false);
  assert.equal(status.effectStartCount, 0);
  await resetHotelBookingDatabase(options);
});

test("cancellation preview is read-only before and after a booking exists", async () => {
  const options = databaseOptions("cancel-preview");
  await resetHotelBookingDatabase(options);
  await prepareHotelBooking(BASE, options);
  const before = await getHotelBookingStatus(BASE, options);
  const preview = await previewHotelCancellation(BASE, {
    ...options,
    now: "2026-10-08T00:00:00.000Z",
  });
  const after = await getHotelBookingStatus(BASE, options);
  assert.equal(preview.stateChanged, false);
  assert.equal(preview.cancellationPreview.changesBooking, false);
  assert.equal(preview.cancellationPreview.estimatedCancellationFeeJpy, 12_000);
  assert.equal(after.state, before.state);
  assert.equal(after.eventCount, before.eventCount);
  assert.equal(after.eventChainHead, before.eventChainHead);
  await resetHotelBookingDatabase(options);
});
