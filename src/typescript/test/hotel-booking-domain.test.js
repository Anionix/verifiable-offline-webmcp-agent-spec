// information_uuid_v5=91e13003-611d-526f-b627-d9a2b5aa8a82
// event_uuid_v7=0199651b-6954-7000-8000-000000000001
// machine-contract: deterministic fixtures prove identity, price, time, and strict-input invariants.
import assert from "node:assert/strict";
import test from "node:test";
import {
  HotelBookingValidationError,
  calculateBookingQuote,
  calculateCancellationPreview,
  createUuidV7,
  defaultBookingInput,
  deriveBookingFingerprint,
  digestCanonicalPayload,
  normalizeBookingInput,
} from "../hotel/booking-domain.js";
import {
  HOTEL_BOOKING_TOOL_INPUT_SCHEMA,
  HotelBookingInputError,
  projectHotelBookingToolInput,
} from "../hotel/input-projection.js";

const BASE = Object.freeze({
  hotelId: "fictional-kyoto-ryokan",
  roomPlanId: "standard-flexible",
  checkInDate: "2026-09-10",
  checkOutDate: "2026-09-12",
  adults: 2,
  rooms: 1,
  preferredLanguage: "en",
});

test("UUIDv5 duplicate identity is stable and excludes presentation language", async () => {
  const english = await deriveBookingFingerprint(BASE);
  const japanese = await deriveBookingFingerprint({ ...BASE, preferredLanguage: "ja" });
  const changedStay = await deriveBookingFingerprint({ ...BASE, checkOutDate: "2026-09-13" });
  assert.equal(english, "d9ee5adb-8a23-5509-850a-d1a61b67d09f");
  assert.equal(japanese, english);
  assert.notEqual(changedStay, english);
  assert.match(english, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
});

test("quote uses integer yen, room nights, and the fixed 12,000 yen unit price", () => {
  assert.deepEqual(calculateBookingQuote({ ...BASE, rooms: 2, adults: 4 }), {
    currency: "JPY",
    unitPriceJpy: 12_000,
    nights: 2,
    rooms: 2,
    roomNights: 4,
    totalPriceJpy: 48_000,
  });
});

test("semantic validation rejects reversed, long, over-capacity, and unsupported stays", () => {
  const rejects = (input, code) => assert.throws(
    () => normalizeBookingInput(input),
    (error) => error instanceof HotelBookingValidationError && error.code === code,
  );
  rejects({ ...BASE, checkOutDate: "2026-09-10" }, "INVALID_STAY_LENGTH");
  rejects({ ...BASE, checkOutDate: "2026-09-25" }, "INVALID_STAY_LENGTH");
  rejects({ ...BASE, rooms: 1, adults: 3 }, "ROOM_CAPACITY_EXCEEDED");
  rejects({ ...BASE, adults: 5, rooms: 2 }, "INVALID_ADULT_COUNT");
  rejects({ ...BASE, rooms: 3 }, "INVALID_ROOM_COUNT");
  rejects({ ...BASE, checkInDate: "2026-02-30" }, "INVALID_DATE");
  rejects({ ...BASE, hotelId: "real-hotel" }, "UNSUPPORTED_HOTEL");
  rejects({ ...BASE, preferredLanguage: "fr" }, "UNSUPPORTED_LANGUAGE");
});

test("cancellation preview changes no state and switches after the exact JST deadline", () => {
  const atDeadline = calculateCancellationPreview(BASE, "2026-09-07T06:00:00.000Z");
  const afterDeadline = calculateCancellationPreview(BASE, "2026-09-07T06:00:00.001Z");
  assert.equal(atDeadline.checkInAt, "2026-09-10T06:00:00.000Z");
  assert.equal(atDeadline.freeCancellationDeadline, "2026-09-07T06:00:00.000Z");
  assert.equal(atDeadline.isFreeCancellation, true);
  assert.equal(atDeadline.estimatedCancellationFeeJpy, 0);
  assert.equal(afterDeadline.isFreeCancellation, false);
  assert.equal(afterDeadline.estimatedCancellationFeeJpy, 12_000);
  assert.equal(afterDeadline.changesBooking, false);
});

test("UUIDv7 embeds the fixed clock and canonical SHA-256 ignores key order", async () => {
  const uuid = createUuidV7(new Date("2026-08-29T00:00:00.000Z"), new Uint8Array(16));
  assert.equal(uuid, "01a04ad0-e800-7000-8000-000000000000");
  assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  const first = await digestCanonicalPayload({ z: 1, a: { y: 2, x: 3 } });
  const second = await digestCanonicalPayload({ a: { x: 3, y: 2 }, z: 1 });
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/u);
});

test("default input is based on the Japan calendar date and remains valid", () => {
  const input = defaultBookingInput("2026-08-28T15:30:00.000Z");
  assert.deepEqual(input, {
    hotelId: "fictional-kyoto-ryokan",
    roomPlanId: "standard-flexible",
    checkInDate: "2026-09-28",
    checkOutDate: "2026-09-30",
    adults: 2,
    rooms: 1,
    preferredLanguage: "en",
  });
  assert.equal(calculateBookingQuote(input).nights, 2);
});

test("WebMCP projection rejects unknown, inherited, accessor, and missing fields", () => {
  assert.equal(HOTEL_BOOKING_TOOL_INPUT_SCHEMA.additionalProperties, false);
  assert.deepEqual(projectHotelBookingToolInput(BASE), BASE);
  assert.throws(
    () => projectHotelBookingToolInput({ ...BASE, authorizePayment: true }),
    (error) => error instanceof HotelBookingInputError && error.code === "UNKNOWN_FIELD",
  );
  assert.throws(
    () => projectHotelBookingToolInput(Object.assign(Object.create({ inherited: true }), BASE)),
    (error) => error instanceof HotelBookingInputError && error.code === "PLAIN_OBJECT_REQUIRED",
  );
  const accessor = { ...BASE };
  Object.defineProperty(accessor, "adults", { enumerable: true, get: () => 2 });
  assert.throws(
    () => projectHotelBookingToolInput(accessor),
    (error) => error instanceof HotelBookingInputError && error.code === "DATA_PROPERTY_REQUIRED",
  );
  const { rooms: _rooms, ...missingRooms } = BASE;
  assert.throws(
    () => projectHotelBookingToolInput(missingRooms),
    (error) => error instanceof HotelBookingInputError && error.code === "MISSING_FIELD",
  );
});
