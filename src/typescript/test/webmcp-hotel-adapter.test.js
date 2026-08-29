// information_uuid_v5=ebd61f96-7d4f-5588-a0b7-df8f54331b5c
// event_uuid_v7=0199651b-6956-7000-8000-000000000001
// machine-contract: discovery exposes exactly four safe hotel tools and no confirmation, payment, or cancellation mutation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { HOTEL_BOOKING_TOOL_INPUT_SCHEMA } from "../hotel/input-projection.js";
import {
  HOTEL_BOOKING_WEBMCP_TOOL_NAMES,
  registerHotelBookingTools,
} from "../hotel/webmcp-adapter.js";

const BASE = Object.freeze({
  hotelId: "fictional-kyoto-ryokan",
  roomPlanId: "standard-flexible",
  checkInDate: "2026-10-10",
  checkOutDate: "2026-10-13",
  adults: 2,
  rooms: 1,
  preferredLanguage: "en",
});

test("the repository schema and all four runtime tools accept the same booking fields", () => {
  const publicSchema = JSON.parse(readFileSync(
    new URL("../../../schemas/hotel-booking-tool-input.schema.json", import.meta.url),
    "utf8",
  ));
  const publicBooking = publicSchema.$defs.bookingInput;
  assert.deepEqual(
    Object.values(publicSchema.properties.toolSchemas.properties).map((rule) => rule.$ref),
    Array(4).fill("#/$defs/bookingInput"),
  );
  assert.equal(publicBooking.additionalProperties, false);
  assert.deepEqual(publicBooking.required, HOTEL_BOOKING_TOOL_INPUT_SCHEMA.required);
  assert.deepEqual(
    Object.keys(publicBooking.properties).sort(),
    Object.keys(HOTEL_BOOKING_TOOL_INPUT_SCHEMA.properties).sort(),
  );
});

test("absence of modelContext is an explicit unsupported result", async () => {
  assert.deepEqual(await registerHotelBookingTools({ runtime: { document: {} } }), {
    supported: false,
    registeredToolNames: [],
  });
});

test("adapter registers exactly four fixed tools with narrow annotations", async () => {
  const tools = [];
  const registrationOptions = [];
  const result = await registerHotelBookingTools({
    runtime: {
      document: {
        modelContext: {
          registerTool(tool, options) {
            tools.push(tool);
            registrationOptions.push(options);
          },
        },
      },
    },
    handlers: {
      checkExistingHotelBooking: async () => ({ operation: "check" }),
      prepareHotelBooking: async () => ({ operation: "prepare" }),
      getHotelBookingStatus: async () => ({ operation: "status" }),
      previewHotelCancellation: async () => ({ operation: "preview" }),
    },
  });
  assert.deepEqual(result, { supported: true, registeredToolNames: HOTEL_BOOKING_WEBMCP_TOOL_NAMES });
  assert.deepEqual(tools.map((tool) => tool.name), [
    "check_existing_hotel_booking",
    "prepare_hotel_booking",
    "get_hotel_booking_status",
    "preview_hotel_cancellation",
  ]);
  assert.deepEqual(registrationOptions, [{ exposedTo: [] }, { exposedTo: [] }, { exposedTo: [] }, { exposedTo: [] }]);
  assert.deepEqual(tools.map((tool) => tool.annotations.readOnlyHint), [true, false, true, true]);
  assert.ok(tools.every((tool) => tool.annotations.destructiveHint === false));
  assert.ok(tools.every((tool) => tool.annotations.idempotentHint === true));
  assert.ok(tools.every((tool) => tool.inputSchema.additionalProperties === false));
  assert.ok(tools.every((tool) => !/(^|_)(confirm|commit|pay|cancel)(_booking)?$/u.test(tool.name)));
});

test("each tool strictly projects input and dispatches only its matching handler", async () => {
  const tools = new Map();
  const calls = [];
  await registerHotelBookingTools({
    runtime: {
      document: { modelContext: { registerTool(tool) { tools.set(tool.name, tool); } } },
    },
    storeOptions: { marker: "store-options" },
    handlers: {
      checkExistingHotelBooking: async (input, options) => { calls.push(["check", input, options]); return { state: "EMPTY" }; },
      prepareHotelBooking: async (input, options) => { calls.push(["prepare", input, options]); return { state: "PREPARED" }; },
      getHotelBookingStatus: async (input, options) => { calls.push(["status", input, options]); return { state: "COMMITTED" }; },
      previewHotelCancellation: async (input, options) => { calls.push(["preview", input, options]); return { stateChanged: false }; },
    },
  });
  assert.deepEqual(await tools.get("check_existing_hotel_booking").execute(BASE), { state: "EMPTY" });
  assert.deepEqual(await tools.get("prepare_hotel_booking").execute(BASE), { state: "PREPARED" });
  assert.deepEqual(await tools.get("get_hotel_booking_status").execute(BASE), { state: "COMMITTED" });
  assert.deepEqual(await tools.get("preview_hotel_cancellation").execute(BASE), { stateChanged: false });
  assert.deepEqual(calls.map((entry) => entry[0]), ["check", "prepare", "status", "preview"]);
  assert.ok(calls.every((entry) => entry[1].hotelId === BASE.hotelId));
  assert.ok(calls.every((entry) => entry[2].marker === "store-options"));
  await assert.rejects(
    tools.get("prepare_hotel_booking").execute({ ...BASE, paymentToken: "not-allowed" }),
    /unknown field/u,
  );
});

test("empty invocation may read the visible current form, while supplied input wins", async () => {
  const tools = new Map();
  const received = [];
  await registerHotelBookingTools({
    runtime: { document: { modelContext: { registerTool(tool) { tools.set(tool.name, tool); } } } },
    getCurrentInput: () => ({ ...BASE, preferredLanguage: "ja" }),
    handlers: {
      checkExistingHotelBooking: async (input) => { received.push(input); return input; },
      prepareHotelBooking: async () => ({}),
      getHotelBookingStatus: async () => ({}),
      previewHotelCancellation: async () => ({}),
    },
  });
  const tool = tools.get("check_existing_hotel_booking");
  assert.equal((await tool.execute({})).preferredLanguage, "ja");
  assert.equal((await tool.execute(BASE)).preferredLanguage, "en");
  assert.deepEqual(received.map((input) => input.preferredLanguage), ["ja", "en"]);
});

test("a completed safe tool result can refresh the visible human approval surface", async () => {
  const tools = new Map();
  const observations = [];
  await registerHotelBookingTools({
    runtime: { document: { modelContext: { registerTool(tool) { tools.set(tool.name, tool); } } } },
    handlers: {
      checkExistingHotelBooking: async () => ({ state: "EMPTY" }),
      prepareHotelBooking: async (input) => ({
        state: "PREPARED",
        fingerprint: `visible:${input.checkInDate}`,
      }),
      getHotelBookingStatus: async () => ({ state: "EMPTY" }),
      previewHotelCancellation: async () => ({ stateChanged: false }),
    },
    onResult: async (observation) => { observations.push(observation); },
  });

  const result = await tools.get("prepare_hotel_booking").execute(BASE);
  assert.deepEqual(result, {
    state: "PREPARED",
    fingerprint: `visible:${BASE.checkInDate}`,
  });
  assert.equal(observations.length, 1);
  assert.equal(observations[0].toolName, "prepare_hotel_booking");
  assert.equal(observations[0].input.checkInDate, BASE.checkInDate);
  assert.equal(observations[0].result.state, "PREPARED");
});
