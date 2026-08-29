// information_uuid_v5=10fe7dfc-405c-523c-ae4a-09aa6a00043d
// event_uuid_v7=01a0491b-3e66-7d00-a3eb-8e48125bd44f
// machine-contract: offline divergence may merge safe tags, but duplicate, ambiguous, forked, or dangerous effect records never execute an external effect.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { globalRecordHash, sha256Hex } from "../sync/crypto.ts";
import {
  createDeviceIdentity,
  createDeviceKeyMaterial,
  SignedDeviceLog,
  verifyDeviceChain,
} from "../sync/device-log.ts";
import { runOfflineSyncSimulation } from "../sync/simulation.ts";
import { LocalSyncLedger, trustAnchorPathForDatabase } from "../sync/synchronizer.ts";
import { SYNC_UUID_NAMESPACE, type OfflineSyncVerificationEvidence, type SignedDeviceEvent } from "../sync/types.ts";
import { uuidV5 } from "../uuid.ts";

// information_uuid_v5=3a0187cc-7497-5325-a2ad-3df91330e778
// event_uuid_v7=01a049ff-0159-7193-b343-dc803d80f4e0
// state_transition=DISCOVERED -> DRY_RUN occurred_at=2026-08-28T20:10:43.929Z
// machine-contract: an unsigned global record cannot relabel a signed dangerous operation as safe, even after its global hash is recomputed.
// information_uuid_v5=4d52b526-114b-5826-8d53-ab6e4dadc476
// event_uuid_v7=01a04a1b-eac6-7c5c-aa43-c19d4a593bfb
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T20:42:18.694Z
// machine-contract: a legacy row is explicitly reported as requiring signed-source rebinding and becomes verifiable after the original signed chain is reingested.
// information_uuid_v5=e7c27b84-7f90-5d05-b838-d5467ac7ee41
// information_uuid_v5=b7c65009-e07f-5668-8618-1b8cff72fa1a
// event_uuid_v7=01a04a2c-246b-7e0e-bc66-2a7ff653aef0
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:00:02.027Z
// machine-contract: the global decision and every indexed identity column must agree with the signed source and canonical audit record.
// information_uuid_v5=62165297-6dec-5f97-a77b-3eb1892678eb
// event_uuid_v7=01a04a3b-7a18-7745-9b09-d8e5a2a74866
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:16:47.000Z
// machine-contract: an individually valid alternate fork cannot replace a source event unless the complete signed device chain and stored checkpoint also verify.
// information_uuid_v5=6bf6cd1e-2220-5770-a630-6bb7eeb0c1ee
// event_uuid_v7=01a04a4c-1be8-7fcc-a67f-5eaff2cc8030
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:34:57.000Z
// machine-contract: every retained prefix checkpoint verifies against its event prefix and the retained checkpoint links form one nonbranching chain.
// information_uuid_v5=c2e27d1a-220f-5c4a-b6f6-7075bf2c5733
// event_uuid_v7=01a04a5a-ece0-7715-a44c-3fe4200880af
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:51:08.000Z
// machine-contract: deleting a retained parent checkpoint leaves a dangling non-null link and must invalidate the signed checkpoint ledger.
// information_uuid_v5=133e9b91-5738-5e1c-8bcd-567a65bba243
// event_uuid_v7=01a04a5f-6d38-7fc8-89b3-1e7daabc661d
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-28T21:56:03.000Z
// machine-contract: a self-consistent SQLite rewrite signed by a substituted key fails against the separately persisted trusted-key digest.

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
    assert.equal(ledger.verifyGlobalChain().valid, true);
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

test("global verification binds each projected operation to its stored signed source event", () => {
  const item = fixture("signed-source-binding");
  const now = clock();
  const identity = createDeviceIdentity("signed-source-binding");
  const log = new SignedDeviceLog(identity, { now });
  const intentId = uuidV5(SYNC_UUID_NAMESPACE, "notification-intent/signed-source-binding");
  log.append({
    type: "DANGEROUS_EFFECT",
    intentId,
    effectKind: "NOTIFICATION",
    payloadDigest: sha256Hex("signed-source-binding"),
  });
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(ledger.ingest(log.events(), log.checkpoint()).status, "INGESTED");
    const row = ledger.database.prepare(`
      SELECT global_sequence, record_json FROM ingestion_events ORDER BY global_sequence DESC LIMIT 1
    `).get() as { global_sequence: number; record_json: string };
    const record = JSON.parse(row.record_json);
    record.operation = { type: "SAFE_TAG_ADD", setId: "forged", tag: "forged" };
    record.decision = "MERGED_SAFE_STATE";
    const { globalHash: _oldHash, ...core } = record;
    record.globalHash = globalRecordHash(record.previousGlobalHash, core);
    ledger.database.prepare(`
      UPDATE ingestion_events SET decision = ?, global_hash = ?, record_json = ? WHERE global_sequence = ?
    `).run(record.decision, record.globalHash, JSON.stringify(record), row.global_sequence);
    assert.equal(ledger.verifyGlobalChain().valid, false);
    ledger.close();
  } finally {
    item.close();
  }
});

test("legacy source-event migration is explicit and repairable by verified reingestion", () => {
  const item = fixture("legacy-source-migration");
  const now = clock();
  const identity = createDeviceIdentity("legacy-source-migration");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "legacy", tag: "source" });
  const checkpoint = log.checkpoint();
  try {
    const original = new LocalSyncLedger(item.database, { now });
    original.registerDevice(identity, log.publicKeyPem());
    assert.equal(original.ingest(log.events(), checkpoint).status, "INGESTED");
    original.close();

    const legacy = new DatabaseSync(item.database);
    legacy.exec("ALTER TABLE ingestion_events DROP COLUMN source_event_json");
    legacy.close();

    const reopened = new LocalSyncLedger(item.database, { now });
    const before = reopened.verifyGlobalChain();
    assert.equal(before.valid, false);
    assert.equal(before.reason, "LEGACY_SOURCE_REBIND_REQUIRED");
    assert.equal(reopened.ingest(log.events(), checkpoint).status, "DUPLICATE");
    const repaired = reopened.verifyGlobalChain();
    assert.equal(repaired.valid, true);
    assert.equal(repaired.reason, "VERIFIED");
    reopened.close();
  } finally {
    item.close();
  }
});

test("global verification derives the decision from the signed operation", () => {
  const item = fixture("signed-decision-binding");
  const now = clock();
  const identity = createDeviceIdentity("signed-decision-binding");
  const log = new SignedDeviceLog(identity, { now });
  log.append({
    type: "DANGEROUS_EFFECT",
    intentId: uuidV5(SYNC_UUID_NAMESPACE, "notification-intent/signed-decision-binding"),
    effectKind: "NOTIFICATION",
    payloadDigest: sha256Hex("signed-decision-binding"),
  });
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(ledger.ingest(log.events(), log.checkpoint()).status, "INGESTED");
    const row = ledger.database.prepare("SELECT global_sequence, record_json FROM ingestion_events").get() as {
      global_sequence: number;
      record_json: string;
    };
    const record = JSON.parse(row.record_json);
    record.decision = "MERGED_SAFE_STATE";
    const { globalHash: _oldHash, ...core } = record;
    record.globalHash = globalRecordHash(record.previousGlobalHash, core);
    ledger.database.prepare(`
      UPDATE ingestion_events SET decision = ?, global_hash = ?, record_json = ? WHERE global_sequence = ?
    `).run(record.decision, record.globalHash, JSON.stringify(record), row.global_sequence);
    assert.equal(ledger.verifyGlobalChain().valid, false);
    ledger.close();
  } finally {
    item.close();
  }
});

test("global verification binds indexed row identity columns to the audit record", () => {
  const item = fixture("indexed-row-binding");
  const now = clock();
  const identity = createDeviceIdentity("indexed-row-binding");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "identity", tag: "bound" });
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(ledger.ingest(log.events(), log.checkpoint()).status, "INGESTED");
    ledger.database.prepare("UPDATE ingestion_events SET source_event_id = ?")
      .run("corrupted-source-event-id");
    assert.equal(ledger.verifyGlobalChain().valid, false);
    ledger.close();
  } finally {
    item.close();
  }
});

test("global verification binds source events to the stored signed device chain", () => {
  const item = fixture("signed-device-chain-binding");
  const now = clock();
  const identity = createDeviceIdentity("signed-device-chain-binding");
  const keys = createDeviceKeyMaterial();
  const acceptedLog = new SignedDeviceLog(identity, { keys, now });
  const alternateFork = new SignedDeviceLog(identity, { keys, now });
  acceptedLog.append({ type: "SAFE_TAG_ADD", setId: "chain", tag: "accepted" });
  alternateFork.append({ type: "SAFE_TAG_ADD", setId: "chain", tag: "alternate" });
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, acceptedLog.publicKeyPem());
    assert.equal(ledger.ingest(acceptedLog.events(), acceptedLog.checkpoint()).status, "INGESTED");
    const forkEvent = alternateFork.events()[0]!;
    const row = ledger.database.prepare("SELECT global_sequence, record_json FROM ingestion_events").get() as {
      global_sequence: number;
      record_json: string;
    };
    const record = JSON.parse(row.record_json);
    record.sourceEventId = forkEvent.eventId;
    record.sourceEventDigest = forkEvent.proof.eventDigest;
    record.sourceChainHash = forkEvent.proof.chainHash;
    record.operation = forkEvent.operation;
    record.decision = "MERGED_SAFE_STATE";
    const { globalHash: _oldHash, ...core } = record;
    record.globalHash = globalRecordHash(record.previousGlobalHash, core);
    ledger.database.prepare(`
      UPDATE ingestion_events
      SET source_event_id = ?, source_event_digest = ?, source_chain_hash = ?, source_event_json = ?,
          decision = ?, global_hash = ?, record_json = ?
      WHERE global_sequence = ?
    `).run(
      forkEvent.eventId,
      forkEvent.proof.eventDigest,
      forkEvent.proof.chainHash,
      JSON.stringify(forkEvent),
      record.decision,
      record.globalHash,
      JSON.stringify(record),
      row.global_sequence,
    );
    const verification = ledger.verifyGlobalChain();
    assert.equal(verification.valid, false);
    assert.equal(verification.reason, "SIGNED_DEVICE_CHAIN_MISMATCH");
    ledger.close();
  } finally {
    item.close();
  }
});

test("global verification checks every retained prefix checkpoint", () => {
  const item = fixture("retained-prefix-checkpoints");
  const now = clock();
  const identity = createDeviceIdentity("retained-prefix-checkpoints");
  const keys = createDeviceKeyMaterial();
  const acceptedLog = new SignedDeviceLog(identity, { keys, now });
  acceptedLog.append({ type: "SAFE_TAG_ADD", setId: "prefix", tag: "accepted-one" });
  const acceptedCheckpointOne = acceptedLog.checkpoint();
  const acceptedEventsOne = acceptedLog.events();
  acceptedLog.append({ type: "SAFE_TAG_ADD", setId: "prefix", tag: "accepted-two" });
  const acceptedCheckpointTwo = acceptedLog.checkpoint();

  const alternateFork = new SignedDeviceLog(identity, { keys, now });
  alternateFork.append({ type: "SAFE_TAG_ADD", setId: "prefix", tag: "alternate-one" });
  alternateFork.checkpoint();
  alternateFork.append({ type: "SAFE_TAG_ADD", setId: "prefix", tag: "alternate-two" });
  const alternateCheckpointTwo = alternateFork.checkpoint();
  const alternateEvents = alternateFork.events();
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, acceptedLog.publicKeyPem());
    assert.equal(ledger.ingest(acceptedEventsOne, acceptedCheckpointOne).status, "INGESTED");
    assert.equal(ledger.ingest(acceptedLog.events(), acceptedCheckpointTwo).status, "INGESTED");

    const rows = ledger.database.prepare(`
      SELECT global_sequence, record_json FROM ingestion_events ORDER BY global_sequence
    `).all() as unknown as Array<{ global_sequence: number; record_json: string }>;
    let previousGlobalHash = JSON.parse(rows[0]!.record_json).previousGlobalHash;
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!;
      const forkEvent = alternateEvents[index]!;
      const record = JSON.parse(row.record_json);
      record.previousGlobalHash = previousGlobalHash;
      record.sourceEventId = forkEvent.eventId;
      record.sourceEventDigest = forkEvent.proof.eventDigest;
      record.sourceChainHash = forkEvent.proof.chainHash;
      record.operation = forkEvent.operation;
      record.decision = "MERGED_SAFE_STATE";
      const { globalHash: _oldHash, ...core } = record;
      record.globalHash = globalRecordHash(previousGlobalHash, core);
      ledger.database.prepare(`
        UPDATE ingestion_events
        SET source_event_id = ?, source_event_digest = ?, source_chain_hash = ?, source_event_json = ?,
            decision = ?, previous_global_hash = ?, global_hash = ?, record_json = ?
        WHERE global_sequence = ?
      `).run(
        forkEvent.eventId,
        forkEvent.proof.eventDigest,
        forkEvent.proof.chainHash,
        JSON.stringify(forkEvent),
        record.decision,
        record.previousGlobalHash,
        record.globalHash,
        JSON.stringify(record),
        row.global_sequence,
      );
      previousGlobalHash = record.globalHash;
    }
    ledger.database.prepare(`
      UPDATE device_checkpoints
      SET checkpoint_digest = ?, chain_head = ?, previous_checkpoint_hash = ?, checkpoint_json = ?
      WHERE device_id = ? AND tree_size = 2
    `).run(
      alternateCheckpointTwo.digest,
      alternateCheckpointTwo.chainHead,
      alternateCheckpointTwo.previousCheckpointHash,
      JSON.stringify(alternateCheckpointTwo),
      identity.deviceId,
    );
    assert.equal(ledger.verifyGlobalChain().valid, false);
    ledger.close();
  } finally {
    item.close();
  }
});

test("global verification rejects a retained checkpoint whose non-null parent is missing", () => {
  const item = fixture("missing-checkpoint-parent");
  const now = clock();
  const identity = createDeviceIdentity("missing-checkpoint-parent");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "parent", tag: "one" });
  const parentCheckpoint = log.checkpoint();
  const firstEvents = log.events();
  log.append({ type: "SAFE_TAG_ADD", setId: "parent", tag: "two" });
  const childCheckpoint = log.checkpoint();
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(ledger.ingest(firstEvents, parentCheckpoint).status, "INGESTED");
    assert.equal(ledger.ingest(log.events(), childCheckpoint).status, "INGESTED");
    const removed = ledger.database.prepare(`
      DELETE FROM device_checkpoints WHERE checkpoint_digest = ?
    `).run(parentCheckpoint.digest);
    assert.equal(removed.changes, 1);
    const verification = ledger.verifyGlobalChain();
    assert.equal(verification.valid, false);
    assert.equal(verification.reason, "SIGNED_DEVICE_CHAIN_MISMATCH");
    ledger.close();
  } finally {
    item.close();
  }
});

test("global verification rejects a self-consistent ledger signed by a substituted database key", () => {
  const item = fixture("substituted-database-key");
  const now = clock();
  const identity = createDeviceIdentity("substituted-database-key");
  const trustedLog = new SignedDeviceLog(identity, { now });
  trustedLog.append({ type: "SAFE_TAG_ADD", setId: "anchor", tag: "trusted" });
  const attackerLog = new SignedDeviceLog(identity, { keys: createDeviceKeyMaterial(), now });
  attackerLog.append({ type: "SAFE_TAG_ADD", setId: "anchor", tag: "substituted" });
  const attackerEvent = attackerLog.events()[0]!;
  const attackerCheckpoint = attackerLog.checkpoint();
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, trustedLog.publicKeyPem());
    assert.equal(ledger.ingest(trustedLog.events(), trustedLog.checkpoint()).status, "INGESTED");
    const row = ledger.database.prepare(`
      SELECT global_sequence, record_json FROM ingestion_events
    `).get() as { global_sequence: number; record_json: string };
    const record = JSON.parse(row.record_json);
    record.sourceEventId = attackerEvent.eventId;
    record.sourceEventDigest = attackerEvent.proof.eventDigest;
    record.sourceChainHash = attackerEvent.proof.chainHash;
    record.operation = attackerEvent.operation;
    record.decision = "MERGED_SAFE_STATE";
    const { globalHash: _oldHash, ...core } = record;
    record.globalHash = globalRecordHash(record.previousGlobalHash, core);
    ledger.database.prepare(`
      UPDATE ingestion_events
      SET source_event_id = ?, source_event_digest = ?, source_chain_hash = ?, source_event_json = ?,
          decision = ?, global_hash = ?, record_json = ?
      WHERE global_sequence = ?
    `).run(
      attackerEvent.eventId,
      attackerEvent.proof.eventDigest,
      attackerEvent.proof.chainHash,
      JSON.stringify(attackerEvent),
      record.decision,
      record.globalHash,
      JSON.stringify(record),
      row.global_sequence,
    );
    ledger.database.prepare("DELETE FROM device_checkpoints WHERE device_id = ?").run(identity.deviceId);
    ledger.database.prepare(`
      INSERT INTO device_checkpoints (
        device_id, checkpoint_digest, tree_size, chain_head, previous_checkpoint_hash, checkpoint_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      attackerCheckpoint.deviceId,
      attackerCheckpoint.digest,
      attackerCheckpoint.treeSize,
      attackerCheckpoint.chainHead,
      attackerCheckpoint.previousCheckpointHash,
      JSON.stringify(attackerCheckpoint),
    );
    ledger.database.prepare(`
      UPDATE known_device_keys SET public_key_pem = ? WHERE device_id = ?
    `).run(attackerLog.publicKeyPem(), identity.deviceId);

    const anchorPath = trustAnchorPathForDatabase(item.database)!;
    const anchorFile = readFileSync(anchorPath, "utf8");
    assert.match(anchorFile, new RegExp(sha256Hex(trustedLog.publicKeyPem())));
    assert.doesNotMatch(anchorFile, /BEGIN PUBLIC KEY/);
    assert.doesNotMatch(anchorFile, new RegExp(sha256Hex(attackerLog.publicKeyPem())));
    ledger.close();
    const reopened = new LocalSyncLedger(item.database, { now });
    const verification = reopened.verifyGlobalChain();
    assert.equal(verification.valid, false);
    assert.equal(verification.reason, "TRUST_ANCHOR_MISMATCH");
    reopened.close();
  } finally {
    item.close();
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
