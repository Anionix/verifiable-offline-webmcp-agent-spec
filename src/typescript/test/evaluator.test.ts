import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { evaluate } from "../evaluator.ts";
import { uuidV5, uuidV7, uuidV7EpochMs } from "../uuid.ts";
import { canonicalJson } from "../canonical.ts";
import type { CanonicalIR } from "../types.ts";

const here = dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(resolve(here, "../../../data/golden-vectors.json"), "utf8"));
const referencePackage = JSON.parse(readFileSync(resolve(here, "../package.json"), "utf8"));
const referenceLock = JSON.parse(readFileSync(resolve(here, "../package-lock.json"), "utf8"));

for (const group of [vectors.pre, vectors.post]) {
  for (const vector of group) {
    test(vector.id, () => assert.equal(evaluate(vector.input as CanonicalIR), vector.expected));
  }
}

test("UUIDv5 RFC DNS example", () => {
  assert.equal(uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com"),
    "2ed6657d-e927-568b-95e1-2665a8aea6a2");
  assert.throws(
    () => uuidV5("6BA7B810-9DAD-11D1-80B4-00C04FD430C8", "www.example.com"),
    /canonical lowercase/,
  );
});

test("UUIDv5 standard implementation is exact, integrity-bound, and has no transitive dependencies", () => {
  assert.equal(referencePackage.dependencies?.uuid, "14.0.2");
  assert.equal(referenceLock.packages?.[""]?.dependencies?.uuid, "14.0.2");
  const installed = referenceLock.packages?.["node_modules/uuid"];
  assert.deepEqual(
    { version: installed?.version, integrity: installed?.integrity, dependencies: installed?.dependencies ?? {} },
    {
      version: "14.0.2",
      integrity: "sha512-xZe/16rV4aa+HGSOCiY2YeLT1OybRLrrkL/Rqaq7p7GMVXjFh+6wN4oMYgjFmnSnhY8t6Xpdl2l9qmnHYuMHwQ==",
      dependencies: {},
    },
  );
});

test("UUIDv7 exposes its Unix millisecond timestamp", () => {
  const ms = 1787825837000;
  assert.equal(uuidV7EpochMs(uuidV7(ms)), ms);
});

test("canonical JSON sorts keys and rejects floats", () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.throws(() => canonicalJson({ x: 0.5 }), /safe integers/);
});

test("post evaluation denies every failed hard gate", () => {
  const source = vectors.post[0]!.input as CanonicalIR;
  // information_uuid_v5=ae1dadb4-46d1-5739-bb6a-9cc0e79935b2
  // event_uuid_v7=01a04cd8-5aea-7d7b-98b6-52e0bebe7d16 state_transition=DYNAMIC_PROPERTY_WRITE -> FIXED_GATE_CASES occurred_at=2026-08-29T09:27:22.602Z
  // machine-contract: TRUSTED_TEST_VECTOR -> ONE_FIXED_GATE_FALSE -> DENY.
  const cases: ReadonlyArray<readonly [string, CanonicalIR["gates"]]> = [
    ["schema", { ...source.gates, schema: false }],
    ["auth", { ...source.gates, auth: false }],
    ["permission", { ...source.gates, permission: false }],
    ["network", { ...source.gates, network: false }],
    ["version", { ...source.gates, version: false }],
    ["dependency", { ...source.gates, dependency: false }],
    ["privacy", { ...source.gates, privacy: false }],
    ["consent", { ...source.gates, consent: false }],
  ];
  for (const [gate, gates] of cases) {
    const input = structuredClone(source);
    input.gates = gates;
    input.state.ambiguousPreviousEffect = false;
    input.state.humanRequired = false;
    input.verification.confidencePPM = input.verification.classFloorPPM;
    input.verification.damage = 0;
    assert.equal(evaluate(input), "DENY", `failed gate ${gate} must deny post evaluation`);
  }
});
