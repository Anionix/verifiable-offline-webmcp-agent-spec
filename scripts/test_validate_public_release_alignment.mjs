#!/usr/bin/env node
// information_uuid_v5=993d0568-015c-5254-baf5-c649d47f2de4
// event_uuid_v7=01a056be-90df-7161-b5c2-f6ce10d6bf15 state_transition=VALID_ALIGNMENT_UNTESTED -> INVALID_SCHEMA_MUTATIONS_REJECTED occurred_at=2026-08-31T07:35:24.639Z
// machine-contract: the current public alignment record passes Draft 2020-12, while missing required fields, unknown root fields, and invalid date-time values fail with a JSON path.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { validateDraft202012 } from "./public-release-alignment-schema.mjs";

const root = resolve(import.meta.dirname, "..");
const alignment = JSON.parse(await readFile(resolve(root, "metadata/public-release-alignment-readback.json"), "utf8"));
const schema = JSON.parse(await readFile(resolve(root, "schemas/public-release-alignment-readback.schema.json"), "utf8"));

function hasError(result, path, validator) {
  return result.errors.some((error) => JSON.stringify(error.path) === JSON.stringify(path) && error.validator === validator);
}

test("accepts the current public alignment record through Draft 2020-12", () => {
  const result = validateDraft202012(alignment, schema);
  assert.deepEqual(result.errors, []);
});

test("rejects required, additional-property, and date-time mutations", () => {
  const missingFormat = structuredClone(alignment);
  delete missingFormat.format;
  const missingLimitations = structuredClone(alignment);
  delete missingLimitations.limitations;
  const additionalRootProperty = structuredClone(alignment);
  additionalRootProperty.unexpectedField = true;
  const invalidTimestamp = structuredClone(alignment);
  invalidTimestamp.identity.observedAt = "not-a-date";

  const cases = [
    [missingFormat, [], "required"],
    [missingLimitations, [], "required"],
    [additionalRootProperty, [], "additionalProperties"],
    [invalidTimestamp, ["identity", "observedAt"], "format"],
  ];
  for (const [instance, path, validator] of cases) {
    const result = validateDraft202012(instance, schema);
    assert.ok(hasError(result, path, validator), `${validator} mutation was not rejected at ${JSON.stringify(path)}`);
  }
});
