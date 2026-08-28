// information_uuid_v5=5c3b4523-0cf8-5ea8-b6bb-06a860adc688
// event_uuid_v7=01a0491b-3df5-7554-a977-05c96268fe34
// machine-contract: TWO_OFFLINE_CHAINS -> VERIFIED_RECONNECT -> SAFE_UNION + HUMAN_REVIEW_REQUIRED; notification starts remain exactly zero.
import { sha256Hex } from "./crypto.ts";
import { createDeviceIdentity, createDeviceKeyMaterial, SignedDeviceLog } from "./device-log.ts";
import { LocalSyncLedger } from "./synchronizer.ts";
import { uuidV5, uuidV7 } from "../uuid.ts";
import {
  SYNC_UUID_NAMESPACE,
  type DangerousReview,
  type GlobalIngestionRecord,
  type QuarantineRecord,
  type SignedCheckpoint,
  type SignedDeviceEvent,
} from "./types.ts";

export interface SimulatedDeviceEvidence {
  label: "端末A" | "端末B";
  deviceId: string;
  logId: string;
  keyId: string;
  publicKeyPem: string;
  events: readonly SignedDeviceEvent[];
  checkpoint: SignedCheckpoint;
}

export interface OfflineSyncSimulationResult {
  identity: { uuidV5: string; uuidV7: string; uuidNamespace: string };
  observedAtEpochMs: number;
  observedAt: string;
  devices: readonly [SimulatedDeviceEvidence, SimulatedDeviceEvidence];
  ingestionRecords: readonly GlobalIngestionRecord[];
  quarantines: readonly QuarantineRecord[];
  safeTags: readonly string[];
  dangerousReviews: readonly DangerousReview[];
  duplicateIngestionDidNotAdvance: boolean;
  deviceSequencesPreserved: boolean;
  globalAuditValid: boolean;
  faultResults: {
    signatureTamperRejected: "INVALID_SIGNATURE";
    sequenceGapRejected: "SEQUENCE_GAP";
    forkRejected: "FORK_DETECTED";
    checkpointMismatchRejected: "CHECKPOINT_MISMATCH";
  };
  externalEffectStarts: 0;
}

function steppingClock(startEpochMs: number): () => number {
  let value = startEpochMs;
  return () => value++;
}

function requireQuarantine<T extends string>(result: { status: string; code?: string }, expected: T): T {
  if (result.status !== "QUARANTINED" || result.code !== expected) {
    throw new Error(`expected ${expected}, got ${result.status}/${result.code ?? "none"}`);
  }
  return expected;
}

function flipBase64(value: string): string {
  return `${value[0] === "A" ? "B" : "A"}${value.slice(1)}`;
}

function flipHex(value: string): string {
  return `${value[0] === "0" ? "1" : "0"}${value.slice(1)}`;
}

export function runOfflineSyncSimulation(
  databasePath: string,
  options: { startEpochMs?: number } = {},
): OfflineSyncSimulationResult {
  const now = steppingClock(options.startEpochMs ?? Date.UTC(2026, 7, 28, 16, 10, 0, 0));
  const deviceAIdentity = createDeviceIdentity("device-a");
  const deviceBIdentity = createDeviceIdentity("device-b");
  const deviceAKeys = createDeviceKeyMaterial();
  const deviceBKeys = createDeviceKeyMaterial();
  const deviceA = new SignedDeviceLog(deviceAIdentity, { keys: deviceAKeys, now });
  const deviceB = new SignedDeviceLog(deviceBIdentity, { keys: deviceBKeys, now });
  const sharedIntentId = uuidV5(SYNC_UUID_NAMESPACE, "notification-intent/offline-sync-demo-shared-operation");
  const sharedPayloadDigest = sha256Hex("offline-sync-demo-notification-payload-v1");

  deviceA.append({ type: "SAFE_TAG_ADD", setId: "demo-tags", tag: "offline-first" });
  deviceA.append({ type: "SAFE_TAG_ADD", setId: "demo-tags", tag: "shared" });
  deviceA.append({
    type: "DANGEROUS_EFFECT",
    intentId: sharedIntentId,
    effectKind: "NOTIFICATION",
    payloadDigest: sharedPayloadDigest,
  });
  const checkpointA = deviceA.checkpoint();

  deviceB.append({ type: "SAFE_TAG_ADD", setId: "demo-tags", tag: "verifiable" });
  deviceB.append({ type: "SAFE_TAG_ADD", setId: "demo-tags", tag: "shared" });
  deviceB.append({
    type: "DANGEROUS_EFFECT",
    intentId: sharedIntentId,
    effectKind: "NOTIFICATION",
    payloadDigest: sharedPayloadDigest,
  });
  const checkpointB = deviceB.checkpoint();

  const ledger = new LocalSyncLedger(databasePath, { now });
  try {
    ledger.registerDevice(deviceAIdentity, deviceA.publicKeyPem());
    ledger.registerDevice(deviceBIdentity, deviceB.publicKeyPem());
    const firstA = ledger.ingest(deviceA.events(), checkpointA);
    const firstB = ledger.ingest(deviceB.events(), checkpointB);
    if (firstA.status !== "INGESTED" || firstB.status !== "INGESTED") throw new Error("healthy device chains were not ingested");
    const beforeDuplicate = ledger.globalCount();
    const duplicate = ledger.ingest(deviceA.events(), checkpointA);
    const duplicateIngestionDidNotAdvance = duplicate.status === "DUPLICATE" && ledger.globalCount() === beforeDuplicate;

    const tamperedEvents = structuredClone(deviceB.events());
    tamperedEvents[0]!.proof.signatureBase64 = flipBase64(tamperedEvents[0]!.proof.signatureBase64);
    const signatureTamperRejected = requireQuarantine(ledger.ingest(tamperedEvents, checkpointB), "INVALID_SIGNATURE");

    const gapIdentity = createDeviceIdentity("device-gap-probe");
    const gapLog = new SignedDeviceLog(gapIdentity, { now });
    gapLog.append({ type: "SAFE_TAG_ADD", setId: "demo-tags", tag: "gap-zero" });
    gapLog.append({ type: "SAFE_TAG_ADD", setId: "demo-tags", tag: "gap-one" });
    const gapCheckpoint = gapLog.checkpoint();
    ledger.registerDevice(gapIdentity, gapLog.publicKeyPem());
    const sequenceGapRejected = requireQuarantine(ledger.ingest(gapLog.events().slice(1), gapCheckpoint), "SEQUENCE_GAP");

    const forkLog = new SignedDeviceLog(deviceAIdentity, { keys: deviceAKeys, now });
    forkLog.append({ type: "SAFE_TAG_ADD", setId: "demo-tags", tag: "alternate-fork" });
    const forkCheckpoint = forkLog.checkpoint();
    const forkRejected = requireQuarantine(ledger.ingest(forkLog.events(), forkCheckpoint), "FORK_DETECTED");

    const mismatchedCheckpoint = structuredClone(checkpointA);
    mismatchedCheckpoint.merkleRoot = flipHex(mismatchedCheckpoint.merkleRoot);
    const checkpointMismatchRejected = requireQuarantine(
      ledger.ingest(deviceA.events(), mismatchedCheckpoint),
      "CHECKPOINT_MISMATCH",
    );

    const ingestionRecords = ledger.ingestionRecords();
    const sequencesByDevice = new Map<string, number[]>();
    for (const record of ingestionRecords) {
      const values = sequencesByDevice.get(record.deviceId) ?? [];
      values.push(record.deviceSequence);
      sequencesByDevice.set(record.deviceId, values);
    }
    const deviceSequencesPreserved = [deviceAIdentity.deviceId, deviceBIdentity.deviceId].every(deviceId =>
      JSON.stringify(sequencesByDevice.get(deviceId)) === JSON.stringify([1, 2, 3]));
    const audit = ledger.verifyGlobalChain();
    const observedAtEpochMs = now();
    return {
      identity: {
        uuidV5: uuidV5(SYNC_UUID_NAMESPACE, "evidence/offline-sync-verification-0.4.0"),
        uuidV7: uuidV7(observedAtEpochMs),
        uuidNamespace: SYNC_UUID_NAMESPACE,
      },
      observedAtEpochMs,
      observedAt: new Date(observedAtEpochMs).toISOString(),
      devices: [
        {
          label: "端末A",
          ...deviceAIdentity,
          publicKeyPem: deviceA.publicKeyPem(),
          events: deviceA.events(),
          checkpoint: checkpointA,
        },
        {
          label: "端末B",
          ...deviceBIdentity,
          publicKeyPem: deviceB.publicKeyPem(),
          events: deviceB.events(),
          checkpoint: checkpointB,
        },
      ],
      ingestionRecords,
      quarantines: ledger.quarantines(),
      safeTags: ledger.safeTags("demo-tags"),
      dangerousReviews: ledger.dangerousReviews(),
      duplicateIngestionDidNotAdvance,
      deviceSequencesPreserved,
      globalAuditValid: audit.valid && audit.count === ingestionRecords.length,
      faultResults: {
        signatureTamperRejected,
        sequenceGapRejected,
        forkRejected,
        checkpointMismatchRejected,
      },
      externalEffectStarts: ledger.externalEffectStarts(),
    };
  } finally {
    ledger.close();
  }
}
