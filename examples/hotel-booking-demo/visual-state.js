// information_uuid_v5=456bcbe5-291b-5ab4-ad60-ca2d59ac8258
// event_uuid_v7=01a0539d-ec32-7548-b0fd-aa0666f6302a occurred_at=2026-08-30T17:00:53.682Z
// state_transition=EMPTY | PREPARED | COMMITTED -> RETRY_RECOGNIZED
// machine-contract: the same observed booking state derives both result surfaces;
// a confirmation number remains hidden until a recognized retry has a booking.

/**
 * @typedef {{
 *   state?: unknown,
 *   bookingExists?: unknown,
 *   attemptCount?: unknown,
 *   effectStartCount?: unknown,
 *   confirmationNumber?: unknown,
 * }} HotelBookingStatusFields
 */

/** @param {unknown} status @returns {HotelBookingStatusFields} */
function statusFields(status) {
  if (status === null || typeof status !== "object" || Array.isArray(status)) return {};
  return /** @type {HotelBookingStatusFields} */ (status);
}

/** @param {unknown} value */
function nonNegativeCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/** @param {number} count @param {string} singular */
function countLabel(count, singular) {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

/** @param {unknown} status */
export function deriveHotelBookingResult(status) {
  const value = statusFields(status);
  const state = typeof value.state === "string" ? value.state : "EMPTY";
  const attempts = nonNegativeCount(value.attemptCount);
  const bookings = value.bookingExists === true ? 1 : 0;
  const effectStarts = nonNegativeCount(value.effectStartCount);
  const counts = [countLabel(attempts, "attempt"), countLabel(bookings, "simulated booking"), countLabel(effectStarts, "effect start")].join(" → ");

  let summary;
  if (state === "RETRY_RECOGNIZED") {
    summary =
      bookings === 1
        ? `Retry recognized: ${counts}. The existing confirmation was recovered.`
        : `Retry recognized: ${counts}. No booking was found to recover.`;
  } else if (state === "COMMITTED") {
    summary = `The success response was intentionally hidden. ${counts}.`;
  } else if (state === "PREPARED") {
    summary = "No booking result yet; human confirmation is still pending.";
  } else if (state === "EXPIRED") {
    summary = "Preparation expired; no booking was created.";
  } else {
    summary = "No booking result yet.";
  }

  const confirmationNumber =
    state === "RETRY_RECOGNIZED" && bookings === 1 && typeof value.confirmationNumber === "string" && value.confirmationNumber.length > 0
      ? value.confirmationNumber
      : null;

  return Object.freeze({ summary, confirmationNumber });
}
