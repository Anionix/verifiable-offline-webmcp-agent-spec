// @ts-check
// information_uuid_v5=6e93e2e0-a0bf-5d41-b650-1a159746e9c7
// event_uuid_v7=01a04c92-0d3a-7ef0-a5c9-4756240f0108
// state_transition=VISIBLE_DRY_RUN -> PAYLOAD_BOUND_APPROVAL occurred_at=2026-08-29T08:14:35.194Z
// machine-contract: an approval binding is an immutable copy of the exact normalized intent and payload digest shown when the human clicked.
// information_uuid_v5=9b293372-27d4-52bd-a95a-f5aeb2c8551f
// event_uuid_v7=01a04c92-0d3b-79bf-829a-8240b0d545b4
// state_transition=PERMISSION_REQUESTED -> SAME_INTENT_PERMISSION_RESULT occurred_at=2026-08-29T08:14:35.195Z
// machine-contract: an asynchronous permission result returns only with the immutable approval binding captured before waiting.

const BINDING_FIELDS = Object.freeze(["intentId", "logicalOperationId", "target", "title", "body", "payloadDigest"]);

/** @param {Record<string, any>} intent */
export function approvalBindingFromIntent(intent) {
  if (!intent || BINDING_FIELDS.some((field) => typeof intent[field] !== "string" || intent[field].length === 0)) {
    throw new TypeError("complete approval binding fields are required");
  }
  return Object.freeze(Object.fromEntries(BINDING_FIELDS.map((field) => [field, intent[field]])));
}

/**
 * @param {Record<string, any>} intent
 * @param {Record<string, any>} binding
 * @param {{ requirePersistedApproval?: boolean }} [options]
 */
export function assertIntentMatchesApprovalBinding(intent, binding, options = {}) {
  const expected = approvalBindingFromIntent(intent);
  if (!binding || BINDING_FIELDS.some((field) => binding[field] !== expected[field])) {
    throw new TypeError("visible notification content does not match the stored dry run");
  }
  if (options.requirePersistedApproval && (intent.approvalIntentId !== binding.intentId || intent.approvalPayloadDigest !== binding.payloadDigest))
    throw new TypeError("persisted approval is not bound to this intent and payload");
  return expected;
}

/**
 * @param {Record<string, any>} binding
 * @param {Readonly<{ logicalOperationId: string, title: string, body: string }>} input
 * @param {string} derivedIntentId
 * @param {string} payloadDigest
 */
export function assertVisibleInputMatchesApproval(binding, input, derivedIntentId, payloadDigest) {
  if (
    !binding ||
    binding.intentId !== derivedIntentId ||
    binding.payloadDigest !== payloadDigest ||
    binding.logicalOperationId !== input.logicalOperationId ||
    binding.title !== input.title ||
    binding.body !== input.body
  )
    throw new TypeError("visible notification changed; store a new dry run before approval");
}

/**
 * @param {Record<string, any>} binding
 * @param {() => Promise<string>} requestPermission
 */
export async function requestPermissionForApproval(binding, requestPermission) {
  const capturedBinding = approvalBindingFromIntent(binding);
  const permission = await requestPermission();
  return Object.freeze({ binding: capturedBinding, permission });
}
