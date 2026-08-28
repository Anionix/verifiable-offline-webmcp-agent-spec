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

for (const group of [vectors.pre, vectors.post]) {
  for (const vector of group) {
    test(vector.id, () => assert.equal(evaluate(vector.input as CanonicalIR), vector.expected));
  }
}

test("UUIDv5 RFC DNS example", () => {
  assert.equal(uuidV5("6ba7b810-9dad-11d1-80b4-00c04fd430c8", "www.example.com"),
    "2ed6657d-e927-568b-95e1-2665a8aea6a2");
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
  for (const gate of Object.keys(source.gates) as Array<keyof CanonicalIR["gates"]>) {
    const input = structuredClone(source);
    input.gates[gate] = false;
    input.state.ambiguousPreviousEffect = false;
    input.state.humanRequired = false;
    input.verification.confidencePPM = input.verification.classFloorPPM;
    input.verification.damage = 0;
    assert.equal(evaluate(input), "DENY", `failed gate ${gate} must deny post evaluation`);
  }
});
