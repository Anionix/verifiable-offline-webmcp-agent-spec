// information_uuid_v5=2f19eacb-01de-5ce1-8c53-6a11bf4cc966
// event_uuid_v7=01a048f8-3326-7152-9e16-1c55a81d7e50
// machine-contract: request bodies cannot choose their provenance; exact origin and cross-field trust invariants fail closed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assertExpectedOrigin,
  externalInputProvenance,
  internalInputProvenance,
  projectInputProvenance,
  provenanceDetails,
  provenanceFromDetails,
  sameProvenance,
} from "../notification/input-provenance.ts";

test("external provenance is server-derived, immutable, and round-trips through attempt details", () => {
  const origin = "http://127.0.0.1:4173";
  const provenance = externalInputProvenance("WEBMCP", origin, origin);
  assert.deepEqual(provenance, {
    channel: "WEBMCP",
    sourceTrust: "UNTRUSTED",
    sourceOrigin: origin,
    untrustedContent: true,
    annotation: "UNTRUSTED_LITERAL",
    derivation: "SERVER_ROUTE",
  });
  assert.equal(Object.isFrozen(provenance), true);
  const readback = provenanceFromDetails(provenanceDetails(provenance));
  assert.equal(sameProvenance(provenance, readback), true);
});

test("origin mismatch and inconsistent trust claims fail closed", () => {
  assert.throws(
    () => assertExpectedOrigin("https://attacker.example", "http://127.0.0.1:4173"),
    /origin must be/,
  );
  assert.throws(
    () => externalInputProvenance("WEBMCP", "https://attacker.example", "http://127.0.0.1:4173"),
    /origin must be/,
  );
  assert.throws(() => projectInputProvenance({
    channel: "WEBMCP",
    sourceTrust: "TRUSTED_INTERNAL",
    sourceOrigin: "http://127.0.0.1:4173",
    untrustedContent: false,
    annotation: "TRUSTED_INTERNAL",
    derivation: "SERVER_ROUTE",
  }), /inconsistent/);
  assert.throws(() => projectInputProvenance({
    ...externalInputProvenance("LOCAL_FORM", "http://127.0.0.1:4173", "http://127.0.0.1:4173"),
    attacker: true,
  }), /unknown field/);
  const getter = { ...externalInputProvenance("WEBMCP", "http://127.0.0.1:4173", "http://127.0.0.1:4173") };
  Object.defineProperty(getter, "sourceTrust", { enumerable: true, get() { throw new Error("must not run"); } });
  assert.throws(() => projectInputProvenance(getter), /data properties/);
});

test("internal provenance cannot impersonate an external channel", () => {
  const internal = internalInputProvenance();
  assert.equal(internal.channel, "TYPED_INTERNAL");
  assert.equal(internal.sourceTrust, "TRUSTED_INTERNAL");
  assert.equal(internal.untrustedContent, false);
  assert.throws(() => projectInputProvenance({ ...internal, channel: "WEBMCP" }), /inconsistent/);
});

test("public provenance schema exposes the same closed contract", async () => {
  const schema = JSON.parse(await readFile(
    new URL("../../../schemas/input-provenance.schema.json", import.meta.url),
    "utf8",
  ));
  assert.equal(schema.oneOf.length, 2);
  for (const variant of schema.oneOf) {
    assert.equal(variant.additionalProperties, false);
    assert.deepEqual(variant.required, [
      "channel",
      "sourceTrust",
      "sourceOrigin",
      "untrustedContent",
      "annotation",
      "derivation",
    ]);
  }
});
