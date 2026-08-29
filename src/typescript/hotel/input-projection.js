// @ts-check
// information_uuid_v5=d88079bf-a672-5220-99cd-a669b737fbd8
// event_uuid_v7=0199651b-6951-7000-8000-000000000001
// state_transition=WEBMCP_UNTRUSTED_INPUT -> STRICT_DATA_PROPERTIES -> NORMALIZED_BOOKING
// machine-contract: unknown, inherited, symbol, accessor, and semantically invalid
// fields stop before IndexedDB. No input field can authorize booking or payment.

import {
  HOTEL_ID,
  ROOM_PLAN_ID,
  HotelBookingValidationError,
  normalizeBookingInput,
} from "./booking-domain.js";

const REQUIRED_FIELDS = Object.freeze([
  "hotelId",
  "roomPlanId",
  "checkInDate",
  "checkOutDate",
  "adults",
  "rooms",
]);
const OPTIONAL_FIELDS = Object.freeze(["preferredLanguage"]);
const ALLOWED_FIELDS = Object.freeze([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);
const ALLOWED_FIELD_SET = new Set(ALLOWED_FIELDS);

export const HOTEL_BOOKING_TOOL_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: REQUIRED_FIELDS,
  properties: Object.freeze({
    hotelId: Object.freeze({
      type: "string",
      const: HOTEL_ID,
      description: "Fixed identifier for the fictional demonstration hotel.",
    }),
    roomPlanId: Object.freeze({
      type: "string",
      const: ROOM_PLAN_ID,
      description: "Fixed identifier for the fictional Standard Flexible plan.",
    }),
    checkInDate: Object.freeze({
      type: "string",
      pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
      description: "Check-in calendar date in YYYY-MM-DD form.",
    }),
    checkOutDate: Object.freeze({
      type: "string",
      pattern: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
      description: "Check-out calendar date in YYYY-MM-DD form, 1 to 14 nights after check-in.",
    }),
    adults: Object.freeze({
      type: "integer",
      minimum: 1,
      maximum: 4,
      description: "Adult guests. Each room accommodates at most two adults.",
    }),
    rooms: Object.freeze({
      type: "integer",
      minimum: 1,
      maximum: 2,
      description: "Number of fictional rooms.",
    }),
    preferredLanguage: Object.freeze({
      type: "string",
      enum: Object.freeze(["en", "ja"]),
      default: "en",
      description: "Presentation language only; excluded from duplicate identity.",
    }),
  }),
});

export const HOTEL_STATUS_TOOL_INPUT_SCHEMA = HOTEL_BOOKING_TOOL_INPUT_SCHEMA;
export const HOTEL_CANCELLATION_TOOL_INPUT_SCHEMA = HOTEL_BOOKING_TOOL_INPUT_SCHEMA;

export class HotelBookingInputError extends HotelBookingValidationError {
  /** @param {string} code @param {string} message @param {string | undefined} [field] */
  constructor(code, message, field) {
    super(code, message, field);
    this.name = "HotelBookingInputError";
  }
}

/**
 * Copy only enumerable data properties from an untrusted tool input before the
 * shared semantic validation runs.
 *
 * @param {unknown} value
 */
export function projectHotelBookingToolInput(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HotelBookingInputError("INPUT_OBJECT_REQUIRED", "hotel booking tool input must be an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new HotelBookingInputError("PLAIN_OBJECT_REQUIRED", "hotel booking tool input must be a plain object");
  }

  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    if (typeof key !== "string" || !ALLOWED_FIELD_SET.has(key)) {
      throw new HotelBookingInputError("UNKNOWN_FIELD", "hotel booking tool input contains an unknown field");
    }
  }

  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const field of REQUIRED_FIELDS) {
    if (!descriptors[field]) {
      throw new HotelBookingInputError("MISSING_FIELD", `${field} is required`, field);
    }
  }
  for (const field of ALLOWED_FIELDS) {
    const descriptor = descriptors[field];
    if (descriptor && (!("value" in descriptor) || descriptor.enumerable !== true)) {
      throw new HotelBookingInputError(
        "DATA_PROPERTY_REQUIRED",
        `${field} must be an enumerable data property`,
        field,
      );
    }
  }

  const projected = Object.fromEntries(ALLOWED_FIELDS
    .filter((field) => descriptors[field])
    .map((field) => [field, descriptors[field].value]));
  try {
    return normalizeBookingInput(projected);
  } catch (error) {
    if (error instanceof HotelBookingValidationError) {
      throw new HotelBookingInputError(error.code, error.message, error.field);
    }
    throw error;
  }
}
