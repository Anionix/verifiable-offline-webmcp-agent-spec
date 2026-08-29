// @ts-check
// information_uuid_v5=91e13003-611d-526f-b627-d9a2b5aa8a82
// event_uuid_v7=0199651b-6950-7000-8000-000000000001
// state_transition=UNTRUSTED_INPUT -> NORMALIZED_BOOKING -> STABLE_UUID_V5
// machine-contract: preferredLanguage is presentation-only and MUST NOT enter the
// UUIDv5 booking fingerprint. Money is represented as integer Japanese yen.

export const HOTEL_ID = "fictional-kyoto-ryokan";
export const ROOM_PLAN_ID = "standard-flexible";
export const ROOM_NIGHT_PRICE_JPY = 12_000;
export const BOOKING_FINGERPRINT_NAMESPACE = "98fd118b-4ebe-5699-bfd1-34514b028aaa";
export const APPROVAL_WINDOW_MILLISECONDS = 120_000;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const textEncoder = new TextEncoder();
const BOOKING_INPUT_FIELDS = Object.freeze([
  "hotelId",
  "roomPlanId",
  "checkInDate",
  "checkOutDate",
  "adults",
  "rooms",
  "preferredLanguage",
]);
const BOOKING_INPUT_FIELD_SET = new Set(BOOKING_INPUT_FIELDS);

export class HotelBookingValidationError extends TypeError {
  /** @param {string} code @param {string} message @param {string | undefined} [field] */
  constructor(code, message, field) {
    super(message);
    this.name = "HotelBookingValidationError";
    this.code = code;
    this.field = field;
  }
}

/** @param {unknown} value */
function requirePlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HotelBookingValidationError("INPUT_OBJECT_REQUIRED", "booking input must be an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new HotelBookingValidationError("PLAIN_OBJECT_REQUIRED", "booking input must be a plain object");
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/** @param {unknown} value @param {string} field */
function requireInteger(value, field) {
  if (!Number.isSafeInteger(value)) {
    throw new HotelBookingValidationError("INTEGER_REQUIRED", `${field} must be a safe integer`, field);
  }
  return /** @type {number} */ (value);
}

/** @param {unknown} value @param {string} field */
function requireDateOnly(value, field) {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) {
    throw new HotelBookingValidationError("DATE_REQUIRED", `${field} must use YYYY-MM-DD`, field);
  }
  const match = DATE_ONLY.exec(value);
  if (!match) throw new HotelBookingValidationError("DATE_REQUIRED", `${field} must use YYYY-MM-DD`, field);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const instant = new Date(Date.UTC(year, month - 1, day));
  if (
    instant.getUTCFullYear() !== year
    || instant.getUTCMonth() !== month - 1
    || instant.getUTCDate() !== day
  ) {
    throw new HotelBookingValidationError("INVALID_DATE", `${field} must be a real calendar date`, field);
  }
  return value;
}

/** @param {string} date */
function dateOnlyToEpochDay(date) {
  const match = DATE_ONLY.exec(date);
  if (!match) throw new HotelBookingValidationError("DATE_REQUIRED", "date must use YYYY-MM-DD");
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

/**
 * Normalize and validate one fictional hotel booking. This function is the
 * shared semantic boundary for the page, IndexedDB store, and WebMCP adapter.
 *
 * @param {unknown} value
 */
export function normalizeBookingInput(value) {
  const source = requirePlainObject(value);
  for (const key of Reflect.ownKeys(source)) {
    if (typeof key !== "string" || !BOOKING_INPUT_FIELD_SET.has(key)) {
      throw new HotelBookingValidationError("UNKNOWN_FIELD", "booking input contains an unknown field");
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(source);
  for (const field of BOOKING_INPUT_FIELDS) {
    const descriptor = descriptors[field];
    if (descriptor && (!("value" in descriptor) || descriptor.enumerable !== true)) {
      throw new HotelBookingValidationError(
        "DATA_PROPERTY_REQUIRED",
        `${field} must be an enumerable data property`,
        field,
      );
    }
  }
  /** @param {string} field */
  const read = (field) => descriptors[field]?.value;
  const hotelId = read("hotelId");
  const roomPlanId = read("roomPlanId");
  if (hotelId !== HOTEL_ID) {
    throw new HotelBookingValidationError("UNSUPPORTED_HOTEL", `hotelId must be ${HOTEL_ID}`, "hotelId");
  }
  if (roomPlanId !== ROOM_PLAN_ID) {
    throw new HotelBookingValidationError("UNSUPPORTED_PLAN", `roomPlanId must be ${ROOM_PLAN_ID}`, "roomPlanId");
  }

  const checkInDate = requireDateOnly(read("checkInDate"), "checkInDate");
  const checkOutDate = requireDateOnly(read("checkOutDate"), "checkOutDate");
  const nights = dateOnlyToEpochDay(checkOutDate) - dateOnlyToEpochDay(checkInDate);
  if (!Number.isSafeInteger(nights) || nights < 1 || nights > 14) {
    throw new HotelBookingValidationError(
      "INVALID_STAY_LENGTH",
      "stay length must be between 1 and 14 nights",
      "checkOutDate",
    );
  }

  const adults = requireInteger(read("adults"), "adults");
  const rooms = requireInteger(read("rooms"), "rooms");
  if (adults < 1 || adults > 4) {
    throw new HotelBookingValidationError("INVALID_ADULT_COUNT", "adults must be between 1 and 4", "adults");
  }
  if (rooms < 1 || rooms > 2) {
    throw new HotelBookingValidationError("INVALID_ROOM_COUNT", "rooms must be between 1 and 2", "rooms");
  }
  if (adults > rooms * 2) {
    throw new HotelBookingValidationError(
      "ROOM_CAPACITY_EXCEEDED",
      "each room can accommodate at most 2 adults",
      "adults",
    );
  }

  const preferredLanguage = read("preferredLanguage") ?? "en";
  if (preferredLanguage !== "en" && preferredLanguage !== "ja") {
    throw new HotelBookingValidationError(
      "UNSUPPORTED_LANGUAGE",
      "preferredLanguage must be en or ja",
      "preferredLanguage",
    );
  }

  return Object.freeze({
    hotelId,
    roomPlanId,
    checkInDate,
    checkOutDate,
    adults,
    rooms,
    preferredLanguage,
  });
}

/**
 * @param {unknown} value
 * @returns {null | string | boolean | number | Array<unknown> | Record<string, unknown>}
 */
function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("canonical payload numbers must be finite");
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  const source = requirePlainObject(value);
  return Object.fromEntries(Object.keys(source).sort().map((key) => [key, canonicalize(source[key])]));
}

/** @param {unknown} value @returns {string} */
export function canonicalJson(value) {
  const result = JSON.stringify(canonicalize(value));
  if (result === undefined) throw new TypeError("canonical payload must be JSON-serializable");
  return result;
}

/** @param {unknown} value */
export async function digestCanonicalPayload(value) {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(canonicalJson(value)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** @param {string} uuid */
function uuidToBytes(uuid) {
  if (!UUID.test(uuid)) throw new TypeError("namespace must be a UUID");
  const hex = uuid.replaceAll("-", "");
  return Uint8Array.from(hex.match(/../gu) ?? [], (pair) => Number.parseInt(pair, 16));
}

/** @param {Uint8Array} bytes */
function bytesToUuid(bytes) {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** @param {string} namespace @param {string} name */
export async function createUuidV5(namespace, name) {
  const namespaceBytes = uuidToBytes(namespace);
  const nameBytes = textEncoder.encode(name);
  const source = new Uint8Array(namespaceBytes.length + nameBytes.length);
  source.set(namespaceBytes);
  source.set(nameBytes, namespaceBytes.length);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", source));
  const bytes = hash.slice(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/**
 * A booking fingerprint is derived from immutable reservation content, never
 * from an attempt number, random value, clock, or display language.
 *
 * @param {unknown} value
 */
export async function deriveBookingFingerprint(value) {
  const input = normalizeBookingInput(value);
  return createUuidV5(BOOKING_FINGERPRINT_NAMESPACE, canonicalJson({
    adults: input.adults,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    hotelId: input.hotelId,
    roomPlanId: input.roomPlanId,
    rooms: input.rooms,
  }));
}

/**
 * Create an RFC 9562 UUIDv7 event identifier. Tests may inject 16 random bytes;
 * production uses the browser cryptographic random source.
 *
 * @param {number | Date} [now]
 * @param {Uint8Array} [randomBytes]
 */
export function createUuidV7(now = Date.now(), randomBytes) {
  const milliseconds = now instanceof Date ? now.getTime() : now;
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0 || milliseconds > 0xffffffffffff) {
    throw new RangeError("UUIDv7 time must fit in 48 bits");
  }
  const bytes = randomBytes ? new Uint8Array(randomBytes) : crypto.getRandomValues(new Uint8Array(16));
  if (bytes.length !== 16) throw new TypeError("UUIDv7 randomBytes must contain 16 bytes");
  let timestamp = BigInt(milliseconds);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(timestamp & 0xffn);
    timestamp >>= 8n;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}

/** @param {unknown} value */
export function calculateBookingQuote(value) {
  const input = normalizeBookingInput(value);
  const nights = dateOnlyToEpochDay(input.checkOutDate) - dateOnlyToEpochDay(input.checkInDate);
  const roomNights = nights * input.rooms;
  return Object.freeze({
    currency: "JPY",
    unitPriceJpy: ROOM_NIGHT_PRICE_JPY,
    nights,
    rooms: input.rooms,
    roomNights,
    totalPriceJpy: roomNights * ROOM_NIGHT_PRICE_JPY,
  });
}

/** @param {number | string | Date | (() => number | string | Date)} value */
export function toEpochMilliseconds(value) {
  const resolved = typeof value === "function" ? value() : value;
  const milliseconds = resolved instanceof Date
    ? resolved.getTime()
    : typeof resolved === "string"
      ? Date.parse(resolved)
      : resolved;
  if (!Number.isFinite(milliseconds)) throw new TypeError("time must identify a valid instant");
  return /** @type {number} */ (milliseconds);
}

/**
 * Preview only. This function never changes a booking. The deadline is exactly
 * 72 hours before 15:00 Japan Standard Time on the check-in date.
 *
 * @param {unknown} value
 * @param {number | string | Date | (() => number | string | Date)} [previewAt]
 */
export function calculateCancellationPreview(value, previewAt = Date.now()) {
  const input = normalizeBookingInput(value);
  const checkInAtMilliseconds = Date.parse(`${input.checkInDate}T15:00:00+09:00`);
  const freeCancellationDeadlineMilliseconds = checkInAtMilliseconds - (72 * 60 * 60 * 1000);
  const previewAtMilliseconds = toEpochMilliseconds(previewAt);
  const lateCancellationFeeJpy = input.rooms * ROOM_NIGHT_PRICE_JPY;
  const isFreeCancellation = previewAtMilliseconds <= freeCancellationDeadlineMilliseconds;
  return Object.freeze({
    currency: "JPY",
    previewAt: new Date(previewAtMilliseconds).toISOString(),
    checkInAt: new Date(checkInAtMilliseconds).toISOString(),
    freeCancellationDeadline: new Date(freeCancellationDeadlineMilliseconds).toISOString(),
    isFreeCancellation,
    estimatedCancellationFeeJpy: isFreeCancellation ? 0 : lateCancellationFeeJpy,
    lateCancellationFeeJpy,
    changesBooking: false,
  });
}

/** @param {number | string | Date | (() => number | string | Date)} [now] */
export function defaultBookingInput(now = Date.now()) {
  const milliseconds = toEpochMilliseconds(now);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(milliseconds));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const japanCalendarDay = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day));
  /** @param {number} offset */
  const toDateOnly = (offset) => new Date(japanCalendarDay + offset * 86_400_000).toISOString().slice(0, 10);
  return Object.freeze({
    hotelId: HOTEL_ID,
    roomPlanId: ROOM_PLAN_ID,
    checkInDate: toDateOnly(30),
    checkOutDate: toDateOnly(32),
    adults: 2,
    rooms: 1,
    preferredLanguage: "en",
  });
}
