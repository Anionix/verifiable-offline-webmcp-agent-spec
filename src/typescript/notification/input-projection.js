// @ts-check
// information_uuid_v5=51b1b201-3e72-55c9-91bd-6478d3a79507
// event_uuid_v7=01a048da-1888-70e0-ae63-0eeaf0ec9fde
// event_uuid_v7=01a04a69-2b03-7076-9df4-0d14afb3349a state_transition=STRICT_SCHEMA -> EVALUATION_READY occurred_at=2026-08-28T22:06:43Z
// machine-contract: RECEIVED -> STRICTLY_PROJECTED -> DRY_RUN; rejection happens before form, SQLite, audit, permission, or notification mutation.

const FIELD_NAMES = Object.freeze(["logicalOperationId", "title", "body"]);
const FIELD_NAME_SET = new Set(FIELD_NAMES);
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F-\u009F]/u;
const DIRECTIONAL_CONTROL = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/u;
const LOGICAL_OPERATION_ID = /^[A-Za-z0-9._:@/-]+$/u;

export const NOTIFICATION_TOOL_INPUT_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: FIELD_NAMES,
  properties: Object.freeze({
    logicalOperationId: Object.freeze({
      type: "string",
      minLength: 1,
      maxLength: 128,
      pattern: "^[A-Za-z0-9._:@/-]+$",
      description: "Stable caller-chosen ID for one desired notification. Reuse it only when retrying that same logical operation; choose a new ID for a different notification.",
    }),
    title: Object.freeze({
      type: "string",
      minLength: 1,
      maxLength: 120,
      pattern: "^[^\\u0000-\\u001F\\u007F-\\u009F\\u061C\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]+$",
      description: "Human-visible notification title. It is stored as untrusted literal text and does not grant permission or approval.",
    }),
    body: Object.freeze({
      type: "string",
      minLength: 1,
      maxLength: 1000,
      pattern: "^[^\\u0000-\\u001F\\u007F-\\u009F\\u061C\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069\\uFEFF]+$",
      description: "Human-visible notification body. It is stored as untrusted literal text and cannot instruct the page to start an effect.",
    }),
  }),
});

/** @typedef {"INPUT_OBJECT_REQUIRED" | "PLAIN_OBJECT_REQUIRED" | "UNKNOWN_FIELD" | "MISSING_FIELD" | "DATA_PROPERTY_REQUIRED" | "STRING_REQUIRED" | "INVALID_UNICODE" | "CONTROL_CHARACTER" | "DIRECTIONAL_CONTROL" | "NONCHARACTER" | "INVALID_LENGTH" | "UNSUPPORTED_CHARACTER"} NotificationInputErrorCode */
/** @typedef {{ logicalOperationId: string, title: string, body: string }} NotificationToolInput */

export class NotificationInputError extends TypeError {
  /**
   * @param {NotificationInputErrorCode} code
   * @param {string} message
   * @param {string | undefined} [field]
   */
  constructor(code, message, field) {
    super(message);
    this.name = "NotificationInputError";
    this.code = code;
    this.field = field;
  }
}

/** @param {string} value */
function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    if (unit >= 0xD800 && unit <= 0xDBFF) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xDC00 && next <= 0xDFFF)) return true;
      index += 1;
    } else if (unit >= 0xDC00 && unit <= 0xDFFF) {
      return true;
    }
  }
  return false;
}

/** @param {string} value */
function hasUnicodeNoncharacter(value) {
  for (const character of value) {
    const point = character.codePointAt(0);
    if (point === undefined) return true;
    if ((point >= 0xFDD0 && point <= 0xFDEF) || (point & 0xFFFF) === 0xFFFE || (point & 0xFFFF) === 0xFFFF) {
      return true;
    }
  }
  return false;
}

/**
 * @param {unknown} value
 * @param {string} field
 * @param {number} maximum
 */
function normalizeText(value, field, maximum) {
  if (typeof value !== "string") {
    throw new NotificationInputError("STRING_REQUIRED", `${field} must be a string`, field);
  }
  if (hasLoneSurrogate(value)) {
    throw new NotificationInputError("INVALID_UNICODE", `${field} must contain well-formed Unicode`, field);
  }
  if (CONTROL_CHARACTER.test(value)) {
    throw new NotificationInputError("CONTROL_CHARACTER", `${field} contains a control character`, field);
  }
  if (DIRECTIONAL_CONTROL.test(value)) {
    throw new NotificationInputError("DIRECTIONAL_CONTROL", `${field} contains a directional control character`, field);
  }
  if (hasUnicodeNoncharacter(value)) {
    throw new NotificationInputError("NONCHARACTER", `${field} contains a Unicode noncharacter`, field);
  }
  const normalized = value.normalize("NFC").trim();
  const length = [...normalized].length;
  if (length < 1 || length > maximum) {
    throw new NotificationInputError("INVALID_LENGTH", `${field} must contain 1-${maximum} Unicode characters`, field);
  }
  return normalized;
}

/**
 * Strictly projects an untrusted WebMCP or localhost API value into the only
 * three fields accepted by the notification preview boundary.
 *
 * @param {unknown} value
 * @returns {Readonly<NotificationToolInput>}
 */
export function projectNotificationToolInput(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new NotificationInputError("INPUT_OBJECT_REQUIRED", "notification input must be an object");
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new NotificationInputError("PLAIN_OBJECT_REQUIRED", "notification input must be a plain object");
  }
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    if (typeof key !== "string" || !FIELD_NAME_SET.has(key)) {
      throw new NotificationInputError("UNKNOWN_FIELD", "notification input contains an unknown field");
    }
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const field of FIELD_NAMES) {
    const descriptor = descriptors[field];
    if (!descriptor) {
      throw new NotificationInputError("MISSING_FIELD", `${field} is required`, field);
    }
    if (!("value" in descriptor) || !descriptor.enumerable) {
      throw new NotificationInputError("DATA_PROPERTY_REQUIRED", `${field} must be an enumerable data property`, field);
    }
  }
  const logicalOperationId = normalizeText(descriptors.logicalOperationId.value, "logicalOperationId", 128);
  if (!LOGICAL_OPERATION_ID.test(logicalOperationId)) {
    throw new NotificationInputError(
      "UNSUPPORTED_CHARACTER",
      "logicalOperationId supports ASCII letters, digits, dot, underscore, colon, at, slash, and hyphen only",
      "logicalOperationId",
    );
  }
  return Object.freeze({
    logicalOperationId,
    title: normalizeText(descriptors.title.value, "title", 120),
    body: normalizeText(descriptors.body.value, "body", 1000),
  });
}
