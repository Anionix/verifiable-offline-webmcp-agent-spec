// information_uuid_v5=10fe7dfc-405c-523c-ae4a-09aa6a00043d
// event_uuid_v7=01a0491b-3e66-7d00-a3eb-8e48125bd44f
// machine-contract: offline divergence may merge safe tags, but duplicate, ambiguous, forked, or dangerous effect records never execute an external effect.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import type { CanonicalValue } from "../canonical.ts";
import { canonicalDigest, checkpointSignatureMessage, globalRecordHash, sha256Hex, signBase64 } from "../sync/crypto.ts";
import { createDeviceIdentity, createDeviceKeyMaterial, SignedDeviceLog, verifyDeviceChain } from "../sync/device-log.ts";
import { runOfflineSyncSimulation } from "../sync/simulation.ts";
import { LocalSyncLedger, trustAnchorPathForDatabase } from "../sync/synchronizer.ts";
import {
  SYNC_UUID_NAMESPACE,
  type OfflineSyncVerificationEvidence,
  type SignedCheckpoint,
  type SignedCheckpointCore,
  type SignedDeviceEvent,
} from "../sync/types.ts";
import { uuidV5, uuidV7 } from "../uuid.ts";

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
// information_uuid_v5=5873e905-b4fe-5cbf-b23e-e92d10068f7b
// event_uuid_v7=01a04c90-aedf-7a0d-bb62-fe99a19ae1c3
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-29T08:09:05.503Z
// machine-contract: a latest-only bootstrap checkpoint is accepted once through its external digest, while a missing interior parent still fails closed.
// information_uuid_v5=542c5141-881b-506e-af3b-fa3f25439622
// event_uuid_v7=01a04c90-aee0-7b99-9581-fa55957b08f4
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-29T08:09:05.504Z
// machine-contract: two ledger instances created from stale anchor snapshots must persist the union and read the complete set after restart.
// information_uuid_v5=adafdf1a-7adc-5cc3-948f-b87cc011e114
// event_uuid_v7=01a04c90-aee1-7e37-a797-81c25dc4b222
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-29T08:09:05.505Z
// machine-contract: a genuine legacy database without an anchor rejects implicit startup and migrates only from a complete matching external key set.
// information_uuid_v5=7dd6096b-95e3-51c1-ae79-caaaa138acf6
// event_uuid_v7=01a04cfe-b737-754d-ac88-851801eeb679
// state_transition=REVIEW -> DRY_RUN occurred_at=2026-08-29T10:10:51.895Z
// machine-contract: two simultaneous FIRST_CHECKPOINT candidates serialize to exactly one retained root, while dead and expired-uninitialized locks recover without ever stealing a live owner's lock.
// information_uuid_v5=48eb0153-4016-5492-89f2-f52d840b65c5
// event_uuid_v7=01a04d10-b64b-79db-8311-644ee54d3524
// state_transition=ROLLBACK_SPLIT -> REGRESSION_PROOF occurred_at=2026-08-29T10:30:33.868Z
// machine-contract: caught SQLite failure restores the prior anchor before unlock, and failed lock initialization may clean only its original directory identity and never a replacement owner's live lock.
// information_uuid_v5=bc645fff-7535-58d2-80c0-9a6bd3a721ee
// event_uuid_v7=01a04d19-f9ee-7e63-a9fe-8b74c23514c6
// state_transition=PATH_SWAP_RISK -> DESCRIPTOR_BOUND_REGRESSION_PROOF occurred_at=2026-08-29T10:40:43.886Z
// machine-contract: missing owner remains recoverable, while symbolic-link and nonregular owner entries never become lock authority; live and dead regular-file owners keep their existing behavior.
// information_uuid_v5=f57b26f1-6a41-5927-8a5d-5599e3b91d1e
// event_uuid_v7=01a04d4d-b6af-73c6-a2ac-cc8f0ae2fc0f
// state_transition=STALE_RECOVERY_OBSERVATION -> REPLACEMENT_OWNER_PRESERVED occurred_at=2026-08-29T14:55:01.000Z
// machine-contract: recovery claims and the main lock are deleted only when the quarantined directory still has the observed identity and owner fingerprint; a replacement never becomes an old observer's deletion target.

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

function spawnConcurrentIngest(
  databasePath: string,
  payloadPath: string,
  checkpointIndex: number,
  startPath: string,
): { ready: Promise<void>; completion: Promise<{ status: string; code?: string }> } {
  const moduleUrl = new URL("../sync/synchronizer.ts", import.meta.url).href;
  const script = `
    import { existsSync, readFileSync } from "node:fs";
    const [databasePath, payloadPath, checkpointIndexText, startPath, moduleUrl] = process.argv.slice(1);
    const { LocalSyncLedger } = await import(moduleUrl);
    const payload = JSON.parse(readFileSync(payloadPath, "utf8"));
    const wait = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));
    const ledger = new LocalSyncLedger(databasePath);
    try {
      process.stdout.write("READY\\n");
      while (!existsSync(startPath)) Atomics.wait(wait, 0, 0, 2);
      const result = ledger.ingest(payload.events, payload.checkpoints[Number(checkpointIndexText)]);
      process.stdout.write(\`RESULT:\${JSON.stringify(result)}\\n\`);
    } finally {
      ledger.close();
    }
  `;
  const child = spawn(
    process.execPath,
    ["--experimental-strip-types", "--input-type=module", "--eval", script, databasePath, payloadPath, String(checkpointIndex), startPath, moduleUrl],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  let errorOutput = "";
  let readyResolve!: () => void;
  let readyReject!: (error: Error) => void;
  let readyObserved = false;
  const ready = new Promise<void>((resolveReady, rejectReady) => {
    readyResolve = resolveReady;
    readyReject = rejectReady;
  });
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (!readyObserved && output.includes("READY\n")) {
      readyObserved = true;
      readyResolve();
    }
  });
  child.stderr.on("data", (chunk) => {
    errorOutput += chunk;
  });
  const completion = new Promise<{ status: string; code?: string }>((resolveCompletion, rejectCompletion) => {
    child.on("error", (error) => {
      if (!readyObserved) readyReject(error);
      rejectCompletion(error);
    });
    child.on("exit", (code) => {
      if (!readyObserved) readyReject(new Error(`concurrent ingest exited before ready: ${errorOutput}`));
      if (code !== 0) {
        rejectCompletion(new Error(`concurrent ingest exited ${code}: ${errorOutput}`));
        return;
      }
      const resultLine = output.split("\n").find((line) => line.startsWith("RESULT:"));
      if (!resultLine) {
        rejectCompletion(new Error(`concurrent ingest returned no result: ${output}`));
        return;
      }
      resolveCompletion(JSON.parse(resultLine.slice("RESULT:".length)) as { status: string; code?: string });
    });
  });
  return { ready, completion };
}

function createLegacyKnownKeyDatabase(databasePath: string, identity: ReturnType<typeof createDeviceIdentity>, publicKeyPem: string): void {
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE known_device_keys (
        device_id TEXT PRIMARY KEY,
        log_id TEXT NOT NULL UNIQUE,
        key_id TEXT NOT NULL UNIQUE,
        public_key_pem TEXT NOT NULL
      );
    `);
    database
      .prepare(`
      INSERT INTO known_device_keys (device_id, log_id, key_id, public_key_pem) VALUES (?, ?, ?, ?)
    `)
      .run(identity.deviceId, identity.logId, identity.keyId, publicKeyPem);
  } finally {
    database.close();
  }
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

test("latest-only initial synchronization binds one omitted checkpoint parent externally", () => {
  const item = fixture("latest-only-bootstrap");
  const now = clock();
  const identity = createDeviceIdentity("latest-only-bootstrap");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "bootstrap", tag: "one" });
  log.checkpoint();
  log.append({ type: "SAFE_TAG_ADD", setId: "bootstrap", tag: "two" });
  log.checkpoint();
  log.append({ type: "SAFE_TAG_ADD", setId: "bootstrap", tag: "three" });
  const latestCheckpoint = log.checkpoint();
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.notEqual(latestCheckpoint.previousCheckpointHash, null);
    assert.equal(ledger.ingest(log.events(), latestCheckpoint).status, "INGESTED");
    assert.equal(ledger.verifyGlobalChain().valid, true);

    const anchorPath = trustAnchorPathForDatabase(item.database)!;
    const anchorFile = JSON.parse(readFileSync(anchorPath, "utf8")) as {
      anchors: Array<{ deviceId: string; bootstrapCheckpointDigest: string | null }>;
    };
    assert.equal(anchorFile.anchors.find((anchor) => anchor.deviceId === identity.deviceId)?.bootstrapCheckpointDigest, latestCheckpoint.digest);

    log.append({ type: "SAFE_TAG_ADD", setId: "bootstrap", tag: "four" });
    const nextCheckpoint = log.checkpoint();
    assert.equal(ledger.ingest(log.events(), nextCheckpoint).status, "INGESTED");
    assert.deepEqual(ledger.safeTags("bootstrap"), ["four", "one", "three", "two"]);
    assert.equal(ledger.verifyGlobalChain().valid, true);
    ledger.close();

    const reopened = new LocalSyncLedger(item.database, { now });
    assert.equal(reopened.verifyGlobalChain().valid, true);
    reopened.close();
  } finally {
    item.close();
  }
});

test("SQLite rollback restores the prior bootstrap anchor before restart and retry", () => {
  const item = fixture("bootstrap-anchor-rollback");
  const now = clock();
  const identity = createDeviceIdentity("bootstrap-anchor-rollback");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "anchor-rollback", tag: "one" });
  log.checkpoint();
  const latestCheckpoint = log.checkpoint();
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    const priorAnchorText = readFileSync(anchorPath, "utf8");
    ledger.database.exec(`
      CREATE TRIGGER abort_safe_tag_insert
      BEFORE INSERT ON safe_tags
      BEGIN
        SELECT RAISE(ABORT, 'forced safe_tags failure');
      END;
    `);

    assert.throws(() => ledger.ingest(log.events(), latestCheckpoint), /forced safe_tags failure/);
    assert.equal(readFileSync(anchorPath, "utf8"), priorAnchorText);
    assert.equal(ledger.globalCount(), 0);
    assert.equal(Number((ledger.database.prepare("SELECT count(*) AS value FROM device_checkpoints").get() as { value: number }).value), 0);
    ledger.close();

    const restarted = new LocalSyncLedger(item.database, { now });
    restarted.database.exec("DROP TRIGGER abort_safe_tag_insert");
    assert.equal(restarted.ingest(log.events(), latestCheckpoint).status, "INGESTED");
    const anchorFile = JSON.parse(readFileSync(anchorPath, "utf8")) as {
      anchors: Array<{ deviceId: string; bootstrapCheckpointDigest: string | null }>;
    };
    assert.equal(anchorFile.anchors.find((anchor) => anchor.deviceId === identity.deviceId)?.bootstrapCheckpointDigest, latestCheckpoint.digest);
    assert.equal(restarted.globalCount(), 1);
    assert.equal(restarted.verifyGlobalChain().valid, true);
    restarted.close();
  } finally {
    item.close();
  }
});

test("anchor-only crash residue fails closed and recovers through the same signed checkpoint", () => {
  const item = fixture("bootstrap-anchor-crash-residue");
  const now = clock();
  const identity = createDeviceIdentity("bootstrap-anchor-crash-residue");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "anchor-crash", tag: "one" });
  log.checkpoint();
  const anchoredCheckpoint = log.checkpoint();
  const alternateCheckpoint = log.checkpoint();
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  try {
    const setup = new LocalSyncLedger(item.database, { now });
    setup.registerDevice(identity, log.publicKeyPem());
    setup.close();

    const crashResidue = JSON.parse(readFileSync(anchorPath, "utf8")) as {
      anchors: Array<{ deviceId: string; bootstrapCheckpointDigest: string | null }>;
    };
    crashResidue.anchors[0]!.bootstrapCheckpointDigest = anchoredCheckpoint.digest;
    writeFileSync(anchorPath, `${JSON.stringify(crashResidue, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

    const restarted = new LocalSyncLedger(item.database, { now });
    const alternateResult = restarted.ingest(log.events(), alternateCheckpoint);
    assert.equal(alternateResult.status, "QUARANTINED");
    if (alternateResult.status === "QUARANTINED") assert.equal(alternateResult.code, "CHECKPOINT_MISMATCH");
    assert.equal(restarted.globalCount(), 0);
    assert.equal(Number((restarted.database.prepare("SELECT count(*) AS value FROM device_checkpoints").get() as { value: number }).value), 0);

    assert.equal(restarted.ingest(log.events(), anchoredCheckpoint).status, "INGESTED");
    assert.equal(restarted.globalCount(), 1);
    assert.equal(restarted.verifyGlobalChain().valid, true);
    restarted.close();
  } finally {
    item.close();
  }
});

test("simultaneous initial synchronization retains exactly one checkpoint root", async () => {
  const item = fixture("simultaneous-checkpoint-root");
  const now = clock();
  const identity = createDeviceIdentity("simultaneous-checkpoint-root");
  const keys = createDeviceKeyMaterial();
  const log = new SignedDeviceLog(identity, { keys, now });
  log.append({ type: "SAFE_TAG_ADD", setId: "serialized-root", tag: "one" });
  const firstCheckpoint = log.checkpoint();
  const secondCheckpointEpochMs = now();
  const secondCheckpointCore: SignedCheckpointCore = {
    version: firstCheckpoint.version,
    checkpointId: uuidV7(secondCheckpointEpochMs),
    createdAt: new Date(secondCheckpointEpochMs).toISOString(),
    createdAtEpochMs: secondCheckpointEpochMs,
    logId: firstCheckpoint.logId,
    deviceId: firstCheckpoint.deviceId,
    keyId: firstCheckpoint.keyId,
    treeSize: firstCheckpoint.treeSize,
    merkleRoot: firstCheckpoint.merkleRoot,
    chainHead: firstCheckpoint.chainHead,
    previousCheckpointHash: null,
  };
  const secondCheckpointDigest = canonicalDigest(secondCheckpointCore as unknown as CanonicalValue);
  const secondCheckpoint: SignedCheckpoint = {
    ...secondCheckpointCore,
    digest: secondCheckpointDigest,
    signature: {
      algorithm: "Ed25519",
      keyId: identity.keyId,
      signatureBase64: signBase64(keys.privateKey, checkpointSignatureMessage(secondCheckpointDigest)),
    },
  };
  const payloadPath = join(item.directory, "concurrent-ingest.json");
  const startPath = join(item.directory, "start");
  try {
    const setup = new LocalSyncLedger(item.database, { now });
    setup.registerDevice(identity, log.publicKeyPem());
    setup.close();
    writeFileSync(
      payloadPath,
      JSON.stringify({
        events: log.events(),
        checkpoints: [firstCheckpoint, secondCheckpoint],
      }),
      { encoding: "utf8", mode: 0o600 },
    );

    const first = spawnConcurrentIngest(item.database, payloadPath, 0, startPath);
    const second = spawnConcurrentIngest(item.database, payloadPath, 1, startPath);
    await Promise.all([first.ready, second.ready]);
    writeFileSync(startPath, "go\n", { encoding: "utf8", mode: 0o600, flag: "wx" });
    const results = await Promise.all([first.completion, second.completion]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["INGESTED", "QUARANTINED"]);
    assert.equal(results.find((result) => result.status === "QUARANTINED")?.code, "CHECKPOINT_MISMATCH");

    const reopened = new LocalSyncLedger(item.database, { now });
    const checkpointCounts = reopened.database
      .prepare(`
      SELECT count(*) AS total,
             sum(CASE WHEN previous_checkpoint_hash IS NULL THEN 1 ELSE 0 END) AS roots
      FROM device_checkpoints WHERE device_id = ?
    `)
      .get(identity.deviceId) as { total: number; roots: number };
    assert.equal(Number(checkpointCounts.total), 1);
    assert.equal(Number(checkpointCounts.roots), 1);
    assert.equal(reopened.globalCount(), 1);
    assert.equal(reopened.verifyGlobalChain().valid, true);
    reopened.close();
  } finally {
    item.close();
  }
});

test("global verification rejects a missing interior checkpoint after a normal root", () => {
  const item = fixture("missing-interior-checkpoint");
  const now = clock();
  const identity = createDeviceIdentity("missing-interior-checkpoint");
  const log = new SignedDeviceLog(identity, { now });
  log.append({ type: "SAFE_TAG_ADD", setId: "interior", tag: "one" });
  const rootCheckpoint = log.checkpoint();
  const rootEvents = log.events();
  log.append({ type: "SAFE_TAG_ADD", setId: "interior", tag: "two" });
  const interiorCheckpoint = log.checkpoint();
  const interiorEvents = log.events();
  log.append({ type: "SAFE_TAG_ADD", setId: "interior", tag: "three" });
  const headCheckpoint = log.checkpoint();
  try {
    const ledger = new LocalSyncLedger(item.database, { now });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(ledger.ingest(rootEvents, rootCheckpoint).status, "INGESTED");
    assert.equal(ledger.ingest(interiorEvents, interiorCheckpoint).status, "INGESTED");
    assert.equal(ledger.ingest(log.events(), headCheckpoint).status, "INGESTED");
    const removed = ledger.database
      .prepare(`
      DELETE FROM device_checkpoints WHERE checkpoint_digest = ?
    `)
      .run(interiorCheckpoint.digest);
    assert.equal(removed.changes, 1);
    const verification = ledger.verifyGlobalChain();
    assert.equal(verification.valid, false);
    assert.equal(verification.reason, "SIGNED_DEVICE_CHAIN_MISMATCH");
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
    assert.deepEqual(
      ledger.ingestionRecords().map((record) => record.globalSequence),
      [1, 2, 3, 4],
    );
    assert.deepEqual(
      ledger
        .ingestionRecords()
        .filter((record) => record.deviceId === identityA.deviceId)
        .map((record) => record.deviceSequence),
      [1, 2],
    );
    assert.deepEqual(ledger.safeTags("set"), ["a", "b"]);
    assert.deepEqual(ledger.dangerousReviews(), [
      {
        intentId,
        effectKind: "NOTIFICATION",
        payloadDigest,
        status: "HUMAN_REVIEW_REQUIRED",
        sourceCount: 2,
        conflictingPayloads: false,
      },
    ]);
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

test("stale ledger instances serialize trust-anchor updates and retain the durable union", () => {
  const item = fixture("concurrent-trust-anchors");
  const now = clock();
  const identityA = createDeviceIdentity("concurrent-anchor-a");
  const identityB = createDeviceIdentity("concurrent-anchor-b");
  const logA = new SignedDeviceLog(identityA, { now });
  const logB = new SignedDeviceLog(identityB, { now });
  logA.append({ type: "SAFE_TAG_ADD", setId: "anchors", tag: "a" });
  logB.append({ type: "SAFE_TAG_ADD", setId: "anchors", tag: "b" });
  const checkpointA = logA.checkpoint();
  const checkpointB = logB.checkpoint();
  try {
    const staleA = new LocalSyncLedger(item.database, { now });
    const staleB = new LocalSyncLedger(item.database, { now });
    staleA.registerDevice(identityA, logA.publicKeyPem());
    staleB.registerDevice(identityB, logB.publicKeyPem());

    const anchorPath = trustAnchorPathForDatabase(item.database)!;
    const anchorFile = JSON.parse(readFileSync(anchorPath, "utf8")) as {
      anchors: Array<{ deviceId: string; publicKeySha256: string }>;
    };
    assert.equal(existsSync(`${anchorPath}.lock`), false);
    assert.deepEqual(anchorFile.anchors.map((anchor) => anchor.deviceId).sort(), [identityA.deviceId, identityB.deviceId].sort());
    assert.deepEqual(
      anchorFile.anchors.map((anchor) => anchor.publicKeySha256).sort(),
      [sha256Hex(logA.publicKeyPem()), sha256Hex(logB.publicKeyPem())].sort(),
    );

    assert.equal(staleA.ingest(logA.events(), checkpointA).status, "INGESTED");
    assert.equal(staleB.ingest(logB.events(), checkpointB).status, "INGESTED");
    staleA.close();
    staleB.close();

    const reopened = new LocalSyncLedger(item.database, { now });
    assert.equal(reopened.verifyGlobalChain().valid, true);
    assert.deepEqual(reopened.safeTags("anchors"), ["a", "b"]);
    reopened.close();
  } finally {
    item.close();
  }
});

test("trust-anchor lock recovers abnormal termination but never displaces a live owner", async () => {
  const item = fixture("recoverable-trust-anchor-lock");
  const now = clock();
  const identityAfterDeadOwner = createDeviceIdentity("anchor-after-dead-owner");
  const identityAfterUninitializedLock = createDeviceIdentity("anchor-after-uninitialized-lock");
  const identityBlockedByLiveOwner = createDeviceIdentity("anchor-blocked-by-live-owner");
  const logAfterDeadOwner = new SignedDeviceLog(identityAfterDeadOwner, { now });
  const logAfterUninitializedLock = new SignedDeviceLog(identityAfterUninitializedLock, { now });
  const logBlockedByLiveOwner = new SignedDeviceLog(identityBlockedByLiveOwner, { now });
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  const lockPath = `${anchorPath}.lock`;
  try {
    const abandonedOwnerProcess = spawn(process.execPath, ["--eval", "setInterval(() => {}, 1_000)"], {
      stdio: "ignore",
    });
    await once(abandonedOwnerProcess, "spawn");
    mkdirSync(lockPath, { mode: 0o700 });
    const deadOwnerEpochMs = Date.now();
    writeFileSync(
      join(lockPath, "owner.json"),
      `${JSON.stringify({
        schemaVersion: 1,
        ownerProcessId: abandonedOwnerProcess.pid,
        acquiredAtEpochMs: deadOwnerEpochMs,
        ownerEventId: uuidV7(deadOwnerEpochMs),
      })}\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
    abandonedOwnerProcess.kill("SIGKILL");
    await once(abandonedOwnerProcess, "exit");
    const ledger = new LocalSyncLedger(item.database, { now, trustAnchorLockTimeoutMs: 40 });
    ledger.registerDevice(identityAfterDeadOwner, logAfterDeadOwner.publicKeyPem());
    assert.equal(existsSync(lockPath), false);

    mkdirSync(lockPath, { mode: 0o700 });
    const expired = new Date(Date.now() - 60_000);
    utimesSync(lockPath, expired, expired);
    ledger.registerDevice(identityAfterUninitializedLock, logAfterUninitializedLock.publicKeyPem());
    assert.equal(existsSync(lockPath), false);

    mkdirSync(lockPath, { mode: 0o700 });
    const liveOwnerEpochMs = Date.now() - 60_000;
    const liveOwner = {
      schemaVersion: 1,
      ownerProcessId: process.pid,
      acquiredAtEpochMs: liveOwnerEpochMs,
      ownerEventId: uuidV7(liveOwnerEpochMs),
    };
    writeFileSync(join(lockPath, "owner.json"), `${JSON.stringify(liveOwner)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    assert.throws(
      () => ledger.registerDevice(identityBlockedByLiveOwner, logBlockedByLiveOwner.publicKeyPem()),
      /timed out waiting for the trusted device key anchor lock/,
    );
    assert.deepEqual(JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8")), liveOwner);

    rmSync(lockPath, { recursive: true, force: false });
    ledger.registerDevice(identityBlockedByLiveOwner, logBlockedByLiveOwner.publicKeyPem());
    const anchorFile = JSON.parse(readFileSync(anchorPath, "utf8")) as { anchors: Array<{ deviceId: string }> };
    assert.deepEqual(
      anchorFile.anchors.map((anchor) => anchor.deviceId).sort(),
      [identityAfterDeadOwner.deviceId, identityAfterUninitializedLock.deviceId, identityBlockedByLiveOwner.deviceId].sort(),
    );
    ledger.close();
  } finally {
    item.close();
  }
});

test("failed lock initialization preserves a replacement live owner's directory", () => {
  const item = fixture("lock-initialization-replacement");
  const now = clock();
  const identity = createDeviceIdentity("lock-initialization-replacement");
  const log = new SignedDeviceLog(identity, { now });
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  const lockPath = `${anchorPath}.lock`;
  const replacementEpochMs = Date.now();
  const replacementOwner = {
    schemaVersion: 1,
    ownerProcessId: process.pid,
    acquiredAtEpochMs: replacementEpochMs,
    ownerEventId: uuidV7(replacementEpochMs),
  };
  let replacementInstalled = false;
  try {
    const ledger = new LocalSyncLedger(item.database, {
      now,
      trustAnchorLockTimeoutMs: 40,
      afterTrustAnchorLockDirectoryCreated: (createdLockPath) => {
        if (replacementInstalled) return;
        replacementInstalled = true;
        assert.equal(createdLockPath, lockPath);
        rmSync(createdLockPath, { recursive: true, force: false });
        mkdirSync(createdLockPath, { mode: 0o700 });
        writeFileSync(join(createdLockPath, "owner.json"), `${JSON.stringify(replacementOwner)}\n`, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
      },
    });
    assert.throws(() => ledger.registerDevice(identity, log.publicKeyPem()), /timed out waiting for the trusted device key anchor lock/);
    assert.equal(replacementInstalled, true);
    assert.equal(existsSync(lockPath), true);
    assert.deepEqual(JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8")), replacementOwner);

    rmSync(lockPath, { recursive: true, force: false });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(existsSync(lockPath), false);
    ledger.close();
  } finally {
    item.close();
  }
});

test("a replaced recovery claim survives the stale observer's quarantine attempt", () => {
  const item = fixture("recovery-claim-replacement");
  const now = clock();
  const identity = createDeviceIdentity("recovery-claim-replacement");
  const log = new SignedDeviceLog(identity, { now });
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  const lockPath = `${anchorPath}.lock`;
  const replacementEpochMs = Date.now();
  const replacementOwner = {
    schemaVersion: 1,
    ownerProcessId: process.pid,
    acquiredAtEpochMs: replacementEpochMs,
    ownerEventId: uuidV7(replacementEpochMs),
  };
  let recoveryClaimPath = "";
  let replacementInstalled = false;
  let ledger: LocalSyncLedger | null = null;
  try {
    mkdirSync(lockPath, { mode: 0o700 });
    const expired = new Date(Date.now() - 60_000);
    utimesSync(lockPath, expired, expired);
    const directoryIdentity = `${statSync(lockPath).dev}-${statSync(lockPath).ino}`;
    recoveryClaimPath = `${lockPath}.recovery-${sha256Hex(directoryIdentity)}`;
    mkdirSync(recoveryClaimPath, { mode: 0o700 });
    utimesSync(recoveryClaimPath, expired, expired);

    ledger = new LocalSyncLedger(item.database, {
      now,
      trustAnchorLockTimeoutMs: 40,
      afterTrustAnchorRecoveryObservation: (observedPath) => {
        if (observedPath !== recoveryClaimPath || replacementInstalled) return;
        replacementInstalled = true;
        rmSync(observedPath, { recursive: true, force: false });
        mkdirSync(observedPath, { mode: 0o700 });
        writeFileSync(join(observedPath, "owner.json"), `${JSON.stringify(replacementOwner)}\n`, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
      },
    });
    assert.throws(() => ledger!.registerDevice(identity, log.publicKeyPem()), /timed out waiting for the trusted device key anchor lock/);
    assert.equal(replacementInstalled, true);
    assert.equal(existsSync(recoveryClaimPath), true);
    assert.deepEqual(JSON.parse(readFileSync(join(recoveryClaimPath, "owner.json"), "utf8")), replacementOwner);
    assert.equal(existsSync(lockPath), true);
  } finally {
    ledger?.close();
    item.close();
  }
});

test("a replaced main lock survives a stale recovery observer", () => {
  const item = fixture("main-lock-replacement");
  const now = clock();
  const identity = createDeviceIdentity("main-lock-replacement");
  const log = new SignedDeviceLog(identity, { now });
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  const lockPath = `${anchorPath}.lock`;
  const replacementEpochMs = Date.now();
  const replacementOwner = {
    schemaVersion: 1,
    ownerProcessId: process.pid,
    acquiredAtEpochMs: replacementEpochMs,
    ownerEventId: uuidV7(replacementEpochMs),
  };
  let replacementInstalled = false;
  let ledger: LocalSyncLedger | null = null;
  try {
    mkdirSync(lockPath, { mode: 0o700 });
    const expired = new Date(Date.now() - 60_000);
    utimesSync(lockPath, expired, expired);
    ledger = new LocalSyncLedger(item.database, {
      now,
      trustAnchorLockTimeoutMs: 40,
      afterTrustAnchorRecoveryObservation: (observedPath) => {
        if (observedPath !== lockPath || replacementInstalled) return;
        replacementInstalled = true;
        rmSync(observedPath, { recursive: true, force: false });
        mkdirSync(observedPath, { mode: 0o700 });
        writeFileSync(join(observedPath, "owner.json"), `${JSON.stringify(replacementOwner)}\n`, {
          encoding: "utf8",
          mode: 0o600,
          flag: "wx",
        });
      },
    });
    assert.throws(() => ledger!.registerDevice(identity, log.publicKeyPem()), /timed out waiting for the trusted device key anchor lock/);
    assert.equal(replacementInstalled, true);
    assert.deepEqual(JSON.parse(readFileSync(join(lockPath, "owner.json"), "utf8")), replacementOwner);
    assert.equal(existsSync(`${lockPath}.recovery-${sha256Hex(`${statSync(lockPath).dev}-${statSync(lockPath).ino}`)}`), false);
  } finally {
    ledger?.close();
    item.close();
  }
});

test("lock-owner reads reject symbolic links and nonregular entries before trusting bytes", () => {
  const item = fixture("lock-owner-descriptor-boundary");
  const now = clock();
  const identity = createDeviceIdentity("lock-owner-descriptor-boundary");
  const log = new SignedDeviceLog(identity, { now });
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  const lockPath = `${anchorPath}.lock`;
  const ownerPath = join(lockPath, "owner.json");
  const outsideOwnerPath = join(item.directory, "outside-owner.json");
  try {
    const ledger = new LocalSyncLedger(item.database, { now, trustAnchorLockTimeoutMs: 40 });
    const outsideText = '{"not":"lock authority"}\n';
    writeFileSync(outsideOwnerPath, outsideText, { encoding: "utf8", mode: 0o600 });

    mkdirSync(lockPath, { mode: 0o700 });
    symlinkSync(outsideOwnerPath, ownerPath);
    assert.throws(() => ledger.registerDevice(identity, log.publicKeyPem()), /trusted device key anchor lock owner must be a regular file/);
    assert.equal(readFileSync(outsideOwnerPath, "utf8"), outsideText);
    assert.equal(existsSync(anchorPath), false);

    rmSync(lockPath, { recursive: true, force: false });
    mkdirSync(lockPath, { mode: 0o700 });
    mkdirSync(ownerPath, { mode: 0o700 });
    assert.throws(() => ledger.registerDevice(identity, log.publicKeyPem()), /trusted device key anchor lock owner must be a regular file/);
    assert.equal(existsSync(anchorPath), false);

    rmSync(lockPath, { recursive: true, force: false });
    ledger.registerDevice(identity, log.publicKeyPem());
    assert.equal(existsSync(lockPath), false);
    assert.equal(existsSync(anchorPath), true);
    ledger.close();
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
    const row = ledger.database
      .prepare(`
      SELECT global_sequence, record_json FROM ingestion_events ORDER BY global_sequence DESC LIMIT 1
    `)
      .get() as { global_sequence: number; record_json: string };
    const record = JSON.parse(row.record_json);
    record.operation = { type: "SAFE_TAG_ADD", setId: "forged", tag: "forged" };
    record.decision = "MERGED_SAFE_STATE";
    const { globalHash: _oldHash, ...core } = record;
    record.globalHash = globalRecordHash(record.previousGlobalHash, core);
    ledger.database
      .prepare(`
      UPDATE ingestion_events SET decision = ?, global_hash = ?, record_json = ? WHERE global_sequence = ?
    `)
      .run(record.decision, record.globalHash, JSON.stringify(record), row.global_sequence);
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

test("legacy database trust migration requires a complete matching external key set", () => {
  const item = fixture("legacy-trust-migration");
  const now = clock();
  const identity = createDeviceIdentity("legacy-trust-migration");
  const secondIdentity = createDeviceIdentity("legacy-trust-migration-second");
  const trustedLog = new SignedDeviceLog(identity, { now });
  const secondTrustedLog = new SignedDeviceLog(secondIdentity, { now });
  trustedLog.append({ type: "SAFE_TAG_ADD", setId: "legacy-trust", tag: "migrated" });
  const checkpoint = trustedLog.checkpoint();
  const substitutedLog = new SignedDeviceLog(identity, { keys: createDeviceKeyMaterial(), now });
  const anchorPath = trustAnchorPathForDatabase(item.database)!;
  try {
    createLegacyKnownKeyDatabase(item.database, identity, trustedLog.publicKeyPem());
    const secondLegacyConnection = new DatabaseSync(item.database);
    secondLegacyConnection
      .prepare(`
      INSERT INTO known_device_keys (device_id, log_id, key_id, public_key_pem) VALUES (?, ?, ?, ?)
    `)
      .run(secondIdentity.deviceId, secondIdentity.logId, secondIdentity.keyId, secondTrustedLog.publicKeyPem());
    secondLegacyConnection.close();
    assert.equal(existsSync(anchorPath), false);
    assert.throws(() => new LocalSyncLedger(item.database, { now }), /explicit trust migration input/);
    assert.equal(existsSync(anchorPath), false);
    assert.throws(
      () =>
        new LocalSyncLedger(item.database, {
          now,
          legacyTrustMigration: [{ identity, publicKeyPem: substitutedLog.publicKeyPem() }],
        }),
      /does not match the stored device identity and key/,
    );
    assert.equal(existsSync(anchorPath), false);
    assert.throws(
      () =>
        new LocalSyncLedger(item.database, {
          now,
          legacyTrustMigration: [{ identity, publicKeyPem: trustedLog.publicKeyPem() }],
        }),
      /explicitly cover every stored device key/,
    );
    assert.equal(existsSync(anchorPath), false);

    const migrated = new LocalSyncLedger(item.database, {
      now,
      legacyTrustMigration: [
        { identity, publicKeyPem: trustedLog.publicKeyPem() },
        { identity: secondIdentity, publicKeyPem: secondTrustedLog.publicKeyPem() },
      ],
    });
    const anchorFile = readFileSync(anchorPath, "utf8");
    assert.match(anchorFile, new RegExp(sha256Hex(trustedLog.publicKeyPem())));
    assert.match(anchorFile, new RegExp(sha256Hex(secondTrustedLog.publicKeyPem())));
    assert.doesNotMatch(anchorFile, /BEGIN PUBLIC KEY/);
    assert.equal(migrated.ingest(trustedLog.events(), checkpoint).status, "INGESTED");
    assert.equal(migrated.verifyGlobalChain().valid, true);
    migrated.close();

    const reopened = new LocalSyncLedger(item.database, { now });
    assert.equal(reopened.verifyGlobalChain().valid, true);
    assert.deepEqual(reopened.safeTags("legacy-trust"), ["migrated"]);
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
    ledger.database
      .prepare(`
      UPDATE ingestion_events SET decision = ?, global_hash = ?, record_json = ? WHERE global_sequence = ?
    `)
      .run(record.decision, record.globalHash, JSON.stringify(record), row.global_sequence);
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
    ledger.database.prepare("UPDATE ingestion_events SET source_event_id = ?").run("corrupted-source-event-id");
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
    ledger.database
      .prepare(`
      UPDATE ingestion_events
      SET source_event_id = ?, source_event_digest = ?, source_chain_hash = ?, source_event_json = ?,
          decision = ?, global_hash = ?, record_json = ?
      WHERE global_sequence = ?
    `)
      .run(
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

    const rows = ledger.database
      .prepare(`
      SELECT global_sequence, record_json FROM ingestion_events ORDER BY global_sequence
    `)
      .all() as unknown as Array<{ global_sequence: number; record_json: string }>;
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
      ledger.database
        .prepare(`
        UPDATE ingestion_events
        SET source_event_id = ?, source_event_digest = ?, source_chain_hash = ?, source_event_json = ?,
            decision = ?, previous_global_hash = ?, global_hash = ?, record_json = ?
        WHERE global_sequence = ?
      `)
        .run(
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
    ledger.database
      .prepare(`
      UPDATE device_checkpoints
      SET checkpoint_digest = ?, chain_head = ?, previous_checkpoint_hash = ?, checkpoint_json = ?
      WHERE device_id = ? AND tree_size = 2
    `)
      .run(
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
    const removed = ledger.database
      .prepare(`
      DELETE FROM device_checkpoints WHERE checkpoint_digest = ?
    `)
      .run(parentCheckpoint.digest);
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
    const row = ledger.database
      .prepare(`
      SELECT global_sequence, record_json FROM ingestion_events
    `)
      .get() as { global_sequence: number; record_json: string };
    const record = JSON.parse(row.record_json);
    record.sourceEventId = attackerEvent.eventId;
    record.sourceEventDigest = attackerEvent.proof.eventDigest;
    record.sourceChainHash = attackerEvent.proof.chainHash;
    record.operation = attackerEvent.operation;
    record.decision = "MERGED_SAFE_STATE";
    const { globalHash: _oldHash, ...core } = record;
    record.globalHash = globalRecordHash(record.previousGlobalHash, core);
    ledger.database
      .prepare(`
      UPDATE ingestion_events
      SET source_event_id = ?, source_event_digest = ?, source_chain_hash = ?, source_event_json = ?,
          decision = ?, global_hash = ?, record_json = ?
      WHERE global_sequence = ?
    `)
      .run(
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
    ledger.database
      .prepare(`
      INSERT INTO device_checkpoints (
        device_id, checkpoint_digest, tree_size, chain_head, previous_checkpoint_hash, checkpoint_json
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)
      .run(
        attackerCheckpoint.deviceId,
        attackerCheckpoint.digest,
        attackerCheckpoint.treeSize,
        attackerCheckpoint.chainHead,
        attackerCheckpoint.previousCheckpointHash,
        JSON.stringify(attackerCheckpoint),
      );
    ledger.database
      .prepare(`
      UPDATE known_device_keys SET public_key_pem = ? WHERE device_id = ?
    `)
      .run(attackerLog.publicKeyPem(), identity.deviceId);

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
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as SignedDeviceEvent);
  assert.equal(evidence.status, "VERIFIED");
  assert.equal(evidence.observations.externalEffectStarts, 0);
  for (const device of evidence.devices) {
    const deviceEvents = events.filter((event) => event.deviceId === device.deviceId);
    const publicKey = readFileSync(resolve(root, device.publicKeyPath), "utf8");
    assert.equal(verifyDeviceChain(deviceEvents, device.checkpoint, publicKey).valid, true);
  }
});
