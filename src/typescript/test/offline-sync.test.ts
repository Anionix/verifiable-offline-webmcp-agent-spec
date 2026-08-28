// information_uuid_v5=10fe7dfc-405c-523c-ae4a-09aa6a00043d
// event_uuid_v7=01a0491b-3e66-7d00-a3eb-8e48125bd44f
// machine-contract: offline divergence may merge safe tags, but duplicate, ambiguous, forked, or dangerous effect records never execute an external effect.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { sha256Hex } from "../sync/crypto.ts";
import {
  createDeviceIdentity,
  createDeviceKeyMaterial,
  SignedDeviceLog,
  verifyDeviceChain,
} from "../sync/device-log.ts";
import { runOfflineSyncSimulation } from "../sync/simulation.ts";
import { LocalSyncLedger } from "../sync/synchronizer.ts";
import { SYNC_UUID_NAMESPACE, type OfflineSyncVerificationEvidence, type SignedDeviceEvent } from "../sync/types.ts";
import { uuidV5 } from "../uuid.ts";

function clock(start = Date.UTC(2026, 7, 28, 17, 0, 0, 0)): () => number {
  let value = start;
  return () => value++;
}

function fixture(name: string): { directory: string; database: string; close(): void } {
  const directory = mkdtempSync(join(tmpdir(), `offline-sync-${name}-`));
  return {
    directory,
    database: join(directory, "sync.sqlite"),
    close: () => rmSync(directory, { recursive: true, force: true }),
  };
}

test("each device maintains an independently verifiable Ed25519 chain and checkpoint", () => {
  const now = clock();
  const identity = createDeviceIdentity("signed-device");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "test-tags", tag: "alpha" });
  log.append({ type: "SAFE_TAG_ADD", setId: "test-tags", tag: "beta" });
  const checkpoint = log.checkpoint();
  const verified = verifyDeviceChain(log.events(), checkpoint, log.publicKeyPem());
  assert.equal(verified.valid, true);
  assert.equal(verified.eventCount, 2);
  assert.match(log.publicKeyPem(), /BEGIN PUBLIC KEY/);
  assert.doesNotMatch(log.publicKeyPem(), /PRIVATE KEY/);

  const tampered = structuredClone(log.events());
  tampered[1]!.proof.signatureBase64 = `${tampered[1]!.proof.signatureBase64[0] === "A" ? "B" : "A"}${tampered[1]!.proof.signatureBase64.slice(1)}`;
  assert.deepEqual(verifyDeviceChain(tampered, checkpoint, log.publicKeyPem()).code, "INVALID_SIGNATURE");

  const badTime = structuredClone(log.events());
  badTime[0]!.occurredAtEpochMs += 1;
  assert.equal(verifyDeviceChain(badTime, checkpoint, log.publicKeyPem()).code, "EVENT_TIME_MISMATCH");

  const nonCanonicalUuid = structuredClone(log.events());
  nonCanonicalUuid[0]!.eventId += "00";
  assert.equal(verifyDeviceChain(nonCanonicalUuid, checkpoint, log.publicKeyPem()).code, "INVALID_UUID");
});

test("successive checkpoints at the same tree size remain linked before growth", () => {
  const item = fixture("checkpoint-link");
  const now = clock();
  const identity = createDeviceIdentity("checkpoint-device");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "set", tag: "one" });
  const firstCheckpoint = log.checkpoint();
  const secondCheckpoint = log.checkpoint();
  const firstEvents = log.events();
  log.append({ type: "SAFE_TAG_ADD", setId: "set", tag: "two" });
  const grownCheckpoint = log.checkpoint();
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(ledger.ingest(firstEvents, firstCheckpoint).status, "INGESTED");
    assert.equal(ledger.ingest(firstEvents, secondCheckpoint).status, "DUPLICATE");
    assert.equal(ledger.ingest(log.events(), grownCheckpoint).status, "INGESTED");
    assert.deepEqual(ledger.safeTags("set"), ["one", "two"]);
    assert.equal(ledger.externalEffectStarts(), 0);
    ledger.close();
  } finally {
    item.close();
  }
});

test("global ingestion is persistent, idempotent, and preserves each device sequence", () => {
  const item = fixture("persistence");
  const now = clock();
  const intentId = uuidV5(SYNC_UUID_NAMESPACE, "notification-intent/persistent-shared-operation");
  const payloadDigest = sha256Hex("same-notification-payload");
  const identityA = createDeviceIdentity("persistent-a");
  const identityB = createDeviceIdentity("persistent-b");
  const logA = new SignedDeviceLog(identityA, { now });
  const logB = new SignedDeviceLog(identityB, { now });
  logA.append({ type: "SAFE_TAG_ADD", setId: "set", tag: "a" });
  logA.append({ type: "DANGEROUS_EFFECT", intentId, effectKind: "NOTIFICATION", payloadDigest });
  logB.append({ type: "SAFE_TAG_ADD", setId: "set", tag: "b" });
  logB.append({ type: "DANGEROUS_EFFECT", intentId, effectKind: "NOTIFICATION", payloadDigest });
  const checkpointA = logA.checkpoint();
  const checkpointB = logB.checkpoint();
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identityA, logA.publicKeyPem());
    ledger.registerDevice(identityB, logB.publicKeyPem());
    assert.equal(ledger.ingest(logB.events(), checkpointB).status, "INGESTED");
    assert.equal(ledger.ingest(logA.events(), checkpointA).status, "INGESTED");
    assert.deepEqual(ledger.ingestionRecords().map(record => record.globalSequence), [1, 2, 3, 4]);
    assert.deepEqual(
      ledger.ingestionRecords().filter(record => record.deviceId === identityA.deviceId).map(record => record.deviceSequence),
      [1, 2],
    );
    assert.deepEqual(ledger.safeTags("set"), ["a", "b"]);
    assert.deepEqual(ledger.dangerousReviews(), [{
      intentId,
      effectKind: "NOTIFICATION",
      payloadDigest,
      status: "HUMAN_REVIEW_REQUIRED",
      sourceCount: 2,
      conflictingPayloads: false,
    }]);
    assert.equal(ledger.externalEffectStarts(), 0);
    assert.equal(ledger.verifyGlobalChain().valid, true);
    ledger.close();

    const reopened = new LocalSyncLedger(item.database, { now });
    const count = reopened.globalCount();
    assert.equal(reopened.ingest(logA.events(), checkpointA).status, "DUPLICATE");
    assert.equal(reopened.globalCount(), count);
    assert.equal(reopened.externalEffectStarts(), 0);
    assert.equal(Object.getOwnPropertyNames(LocalSyncLedger.prototype).includes("execute"), false);
    assert.equal(Object.getOwnPropertyNames(LocalSyncLedger.prototype).includes("notify"), false);
    reopened.close();
  } finally {
    item.close();
  }
});

test("safe add-only state converges regardless of device order and repeated ingestion", () => {
  const now = clock();
  const identityA = createDeviceIdentity("converge-a");
  const identityB = createDeviceIdentity("converge-b");
  const keysA = createDeviceKeyMaterial();
  const keysB = createDeviceKeyMaterial();
  const logA = new SignedDeviceLog(identityA, { keys: keysA, now });
  const logB = new SignedDeviceLog(identityB, { keys: keysB, now });
  for (const tag of ["common", "left"]) logA.append({ type: "SAFE_TAG_ADD", setId: "set", tag });
  for (const tag of ["common", "right"]) logB.append({ type: "SAFE_TAG_ADD", setId: "set", tag });
  const checkpointA = logA.checkpoint();
  const checkpointB = logB.checkpoint();
  const first = fixture("order-one");
  const second = fixture("order-two");
  try {
    const one = new LocalSyncLedger(first.database, { now });
    const two = new LocalSyncLedger(second.database, { now });
    for (const ledger of [one, two]) {
      ledger.registerDevice(identityA, logA.publicKeyPem());
      ledger.registerDevice(identityB, logB.publicKeyPem());
    }
    one.ingest(logA.events(), checkpointA);
    one.ingest(logB.events(), checkpointB);
    one.ingest(logA.events(), checkpointA);
    two.ingest(logB.events(), checkpointB);
    two.ingest(logA.events(), checkpointA);
    two.ingest(logB.events(), checkpointB);
    assert.deepEqual(one.safeTags("set"), ["common", "left", "right"]);
    assert.deepEqual(two.safeTags("set"), one.safeTags("set"));
    one.close();
    two.close();
  } finally {
    first.close();
    second.close();
  }
});

test("simulation rejects signature tampering, sequence gaps, forks, and checkpoint mismatch", () => {
  const item = fixture("faults");
  try {
    const result = runOfflineSyncSimulation(item.database);
    assert.deepEqual(result.safeTags, ["offline-first", "shared", "verifiable"]);
    assert.deepEqual(result.faultResults, {
      signatureTamperRejected: "INVALID_SIGNATURE",
      sequenceGapRejected: "SEQUENCE_GAP",
      forkRejected: "FORK_DETECTED",
      checkpointMismatchRejected: "CHECKPOINT_MISMATCH",
    });
    assert.equal(result.quarantines.length, 4);
    assert.equal(result.ingestionRecords.length, 6);
    assert.equal(result.dangerousReviews[0]!.sourceCount, 2);
    assert.equal(result.externalEffectStarts, 0);
    assert.equal(result.globalAuditValid, true);
  } finally {
    item.close();
  }
});

test("tracked public evidence reads back through independent public keys", () => {
  const root = resolve(import.meta.dirname, "../../..");
  const evidence = JSON.parse(readFileSync(resolve(root, "metadata/offline-sync-verification.json"), "utf8")) as OfflineSyncVerificationEvidence;
  const events = readFileSync(resolve(root, evidence.artifacts.deviceEvents), "utf8")
    .trim().split("\n").map(line => JSON.parse(line) as SignedDeviceEvent);
  assert.equal(evidence.status, "VERIFIED");
  assert.equal(evidence.observations.externalEffectStarts, 0);
  for (const device of evidence.devices) {
    const deviceEvents = events.filter(event => event.deviceId === device.deviceId);
    const publicKey = readFileSync(resolve(root, device.publicKeyPath), "utf8");
    assert.equal(verifyDeviceChain(deviceEvents, device.checkpoint, publicKey).valid, true);
  }
});
