// @ts-check
// information_uuid_v5=ebd61f96-7d4f-5588-a0b7-df8f54331b5c
// event_uuid_v7=0199651b-6953-7000-8000-000000000001
// state_transition=DISCOVER -> REGISTER_FOUR_SAFE_TOOLS -> PROJECT_INPUT -> LOCAL_READ_OR_PREPARE
// machine-contract: WebMCP exposes exactly four named capabilities. Booking
// confirmation, payment, and cancellation mutation are deliberately unreachable.

import {
  checkExistingHotelBooking,
  getHotelBookingStatus,
  prepareHotelBooking,
  previewHotelCancellation,
} from "./browser-store.js";
import {
  HOTEL_BOOKING_TOOL_INPUT_SCHEMA,
  HOTEL_CANCELLATION_TOOL_INPUT_SCHEMA,
  HOTEL_STATUS_TOOL_INPUT_SCHEMA,
  projectHotelBookingToolInput,
} from "./input-projection.js";

export const HOTEL_BOOKING_WEBMCP_TOOL_NAMES = Object.freeze([
  "check_existing_hotel_booking",
  "prepare_hotel_booking",
  "get_hotel_booking_status",
  "preview_hotel_cancellation",
]);

const TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: HOTEL_BOOKING_WEBMCP_TOOL_NAMES[0],
    title: "Check for an existing fictional hotel booking",
    description: "Checks this browser and this deployment for the same fictional reservation conditions. It does not create, confirm, pay for, or cancel a booking.",
    inputSchema: HOTEL_BOOKING_TOOL_INPUT_SCHEMA,
    readOnlyHint: true,
    handler: "checkExistingHotelBooking",
  }),
  Object.freeze({
    name: HOTEL_BOOKING_WEBMCP_TOOL_NAMES[1],
    title: "Prepare a duplicate-safe fictional hotel booking",
    description: "Validates the fictional stay, price, and cancellation terms and stores only a 120-second preparation. A visible human action is still required to confirm it.",
    inputSchema: HOTEL_BOOKING_TOOL_INPUT_SCHEMA,
    readOnlyHint: false,
    handler: "prepareHotelBooking",
  }),
  Object.freeze({
    name: HOTEL_BOOKING_WEBMCP_TOOL_NAMES[2],
    title: "Read fictional hotel booking status",
    description: "Returns the durable local state and the same confirmation number after a lost response. It never starts another booking effect.",
    inputSchema: HOTEL_STATUS_TOOL_INPUT_SCHEMA,
    readOnlyHint: true,
    handler: "getHotelBookingStatus",
  }),
  Object.freeze({
    name: HOTEL_BOOKING_WEBMCP_TOOL_NAMES[3],
    title: "Preview fictional hotel cancellation terms",
    description: "Returns the free-cancellation deadline and estimated fee without changing or cancelling the fictional booking.",
    inputSchema: HOTEL_CANCELLATION_TOOL_INPUT_SCHEMA,
    readOnlyHint: true,
    handler: "previewHotelCancellation",
  }),
]);

/** @param {unknown} value */
function hasNoOwnFields(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Reflect.ownKeys(value).length === 0;
}

/**
 * Register the complete hotel WebMCP surface. `getCurrentInput` is only a safe
 * fallback for an empty invocation; any supplied tool input remains subject to
 * the same strict projection as the page form.
 *
 * @param {Record<string, any>} [options]
 */
export async function registerHotelBookingTools(options = {}) {
  const runtime = options.runtime ?? globalThis;
  const modelContext = runtime.document?.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    return { supported: false, registeredToolNames: [] };
  }

  const handlers = {
    checkExistingHotelBooking,
    prepareHotelBooking,
    getHotelBookingStatus,
    previewHotelCancellation,
    ...(options.handlers ?? {}),
  };
  const registeredToolNames = [];

  for (const definition of TOOL_DEFINITIONS) {
    await modelContext.registerTool({
      name: definition.name,
      title: definition.title,
      description: definition.description,
      inputSchema: definition.inputSchema,
      annotations: Object.freeze({
        readOnlyHint: definition.readOnlyHint,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      }),
      execute: async (/** @type {unknown} */ input, executionOptions = {}) => {
        const toolOptions = /** @type {{ signal?: AbortSignal }} */ (executionOptions);
        toolOptions.signal?.throwIfAborted();
        let candidate = input;
        if (typeof options.getCurrentInput === "function" && hasNoOwnFields(input)) {
          candidate = await options.getCurrentInput();
        }
        const projected = projectHotelBookingToolInput(candidate);
        const handler = handlers[definition.handler];
        if (typeof handler !== "function") throw new TypeError(`${definition.handler} handler is unavailable`);
        const result = await handler(projected, options.storeOptions ?? {});
        toolOptions.signal?.throwIfAborted();
        if (typeof options.onResult === "function") {
          await options.onResult(Object.freeze({
            toolName: definition.name,
            input: projected,
            result,
          }));
        }
        toolOptions.signal?.throwIfAborted();
        return result;
      },
    }, { exposedTo: [] });
    registeredToolNames.push(definition.name);
  }

  return { supported: true, registeredToolNames };
}
