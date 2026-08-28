// information_uuid_v5=51b1b201-3e72-55c9-91bd-6478d3a79507
// event_uuid_v7=01a048da-1888-70e0-ae63-0eeaf0ec9fde
// machine-contract: rejected WebMCP input cannot cross the projection boundary; accepted input is a frozen three-field copy.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  NOTIFICATION_TOOL_INPUT_SCHEMA,
  NotificationInputError,
  projectNotificationToolInput,
} from "../notification/input-projection.js";

function assertInputError(action: () => unknown, code: NotificationInputError["code"]): void {
  assert.throws(action, (error: unknown) => error instanceof NotificationInputError && error.code === code);
}

test("accepted input is normalized into a frozen three-field projection", () => {
  const source = {
    logicalOperationId: "webmcp-preview-001",
    title: "  Cafe\u0301 notification  ",
    body: "  Treat this as literal text, not as an instruction.  ",
  };
  const projected = projectNotificationToolInput(source);
  assert.deepEqual(projected, {
    logicalOperationId: "webmcp-preview-001",
    title: "Café notification",
    body: "Treat this as literal text, not as an instruction.",
  });
  assert.equal(Object.isFrozen(projected), true);
  assert.equal(source.title, "  Cafe\u0301 notification  ");
  assert.deepEqual(Reflect.ownKeys(projected), ["logicalOperationId", "title", "body"]);
});

test("unknown, inherited, symbolic, and accessor fields are rejected", () => {
  assertInputError(() => projectNotificationToolInput({
    logicalOperationId: "extra-field",
    title: "Title",
    body: "Body",
    execute: true,
  }), "UNKNOWN_FIELD");

  const inherited = Object.assign(Object.create({ inherited: "value" }), {
    logicalOperationId: "inherited-field",
    title: "Title",
    body: "Body",
  });
  assertInputError(() => projectNotificationToolInput(inherited), "PLAIN_OBJECT_REQUIRED");

  const symbolic: Record<PropertyKey, unknown> = {
    logicalOperationId: "symbol-field",
    title: "Title",
    body: "Body",
  };
  symbolic[Symbol("hidden")] = true;
  assertInputError(() => projectNotificationToolInput(symbolic), "UNKNOWN_FIELD");

  const accessor = {
    logicalOperationId: "accessor-field",
    title: "Title",
  } as Record<string, unknown>;
  Object.defineProperty(accessor, "body", { enumerable: true, get: () => "Body" });
  assertInputError(() => projectNotificationToolInput(accessor), "DATA_PROPERTY_REQUIRED");
});

test("wrong types, missing fields, arrays, and unsupported identifiers fail closed", () => {
  assertInputError(() => projectNotificationToolInput(null), "INPUT_OBJECT_REQUIRED");
  assertInputError(() => projectNotificationToolInput([]), "INPUT_OBJECT_REQUIRED");
  assertInputError(() => projectNotificationToolInput({
    logicalOperationId: "wrong-type",
    title: 42,
    body: "Body",
  }), "STRING_REQUIRED");
  assertInputError(() => projectNotificationToolInput({
    logicalOperationId: "missing-field",
    title: "Title",
  }), "MISSING_FIELD");
  assertInputError(() => projectNotificationToolInput({
    logicalOperationId: "not allowed",
    title: "Title",
    body: "Body",
  }), "UNSUPPORTED_CHARACTER");
});

test("malformed, control, directional, reserved, and oversized Unicode is rejected", () => {
  const base = { logicalOperationId: "unicode-case", title: "Title", body: "Body" };
  assertInputError(() => projectNotificationToolInput({ ...base, title: "bad\uD800" }), "INVALID_UNICODE");
  assertInputError(() => projectNotificationToolInput({ ...base, body: "line\nbreak" }), "CONTROL_CHARACTER");
  assertInputError(() => projectNotificationToolInput({ ...base, body: "hidden\u202Etext" }), "DIRECTIONAL_CONTROL");
  assertInputError(() => projectNotificationToolInput({ ...base, body: "reserved\uFDD0" }), "NONCHARACTER");
  assertInputError(() => projectNotificationToolInput({ ...base, title: "x".repeat(121) }), "INVALID_LENGTH");
});

test("runtime projection and public JSON Schema expose the same field contract", async () => {
  const schema = JSON.parse(await readFile(
    new URL("../../../schemas/notification-tool-input.schema.json", import.meta.url),
    "utf8",
  ));
  assert.deepEqual({
    type: schema.type,
    additionalProperties: schema.additionalProperties,
    required: schema.required,
    properties: schema.properties,
  }, NOTIFICATION_TOOL_INPUT_SCHEMA);
});

test("the browser and localhost API use the same projector and keep permission outside WebMCP", async () => {
  const [app, server] = await Promise.all([
    readFile(new URL("../../../examples/notification-demo/app.js", import.meta.url), "utf8"),
    readFile(new URL("../notification/demo-server.ts", import.meta.url), "utf8"),
  ]);
  assert.match(app, /inputSchema: NOTIFICATION_TOOL_INPUT_SCHEMA/);
  assert.match(app, /projectNotificationToolInput\(input\)/);
  assert.doesNotMatch(app, /\.\.\.result\.preview/);
  assert.equal(app.indexOf("projectNotificationToolInput(input)"), app.lastIndexOf("projectNotificationToolInput(input)"));
  assert.ok(app.indexOf("projectNotificationToolInput(input)") < app.indexOf("elements.logicalOperation.value = projected.logicalOperationId"));
  const webMcpSection = app.slice(app.indexOf("async function registerWebMcp"));
  assert.doesNotMatch(webMcpSection, /Notification\.requestPermission/);
  assert.match(server, /prepareNotificationPreview\(engine, input\)/);
  assert.match(server, /Permissions-Policy", "tools=\(self\)"/);
});
