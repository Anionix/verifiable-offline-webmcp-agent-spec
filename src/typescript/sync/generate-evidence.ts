// information_uuid_v5=f5de2fbf-e238-5066-acc2-6799865f9bf3
// event_uuid_v7=01a0491b-3e2f-7a87-aeae-33dd1fad7546
// machine-contract: generated evidence contains public keys only; fresh private keys remain process-local and are discarded after signing.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "./crypto.ts";
import { runOfflineSyncSimulation } from "./simulation.ts";
import { trustAnchorPathForDatabase } from "./synchronizer.ts";
import { SYNC_VERSION, type OfflineSyncVerificationEvidence } from "./types.ts";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(moduleDirectory, "../../..");
const databasePath = resolve(repositoryRoot, ".local/offline-sync-evidence.sqlite");
const eventPath = resolve(repositoryRoot, "data/audit/offline-sync-device-events.ndjson");
const ingestionPath = resolve(repositoryRoot, "data/audit/offline-sync-ingestion.ndjson");
const quarantinePath = resolve(repositoryRoot, "data/audit/offline-sync-quarantine.ndjson");
const evidencePath = resolve(repositoryRoot, "metadata/offline-sync-verification.json");
const keyPaths = [
  resolve(repositoryRoot, "data/audit/keys/offline-device-a-public-key.pem"),
  resolve(repositoryRoot, "data/audit/keys/offline-device-b-public-key.pem"),
] as const;

for (const path of [
  databasePath,
  `${databasePath}-wal`,
  `${databasePath}-shm`,
  trustAnchorPathForDatabase(databasePath)!,
]) rmSync(path, { force: true });
const result = runOfflineSyncSimulation(databasePath);
const reviews = result.dangerousReviews;
if (
  reviews.length !== 1
  || reviews[0]!.status !== "HUMAN_REVIEW_REQUIRED"
  || !result.duplicateIngestionDidNotAdvance
  || !result.deviceSequencesPreserved
  || !result.globalAuditValid
  || result.externalEffectStarts !== 0
) {
  throw new Error("simulation invariants failed; no public evidence was written");
}
const eventBytes = Buffer.from(
  result.devices.flatMap(device => device.events).map(event => JSON.stringify(event)).join("\n") + "\n",
  "utf8",
);
const ingestionBytes = Buffer.from(result.ingestionRecords.map(record => JSON.stringify(record)).join("\n") + "\n", "utf8");
const quarantineBytes = Buffer.from(result.quarantines.map(record => JSON.stringify(record)).join("\n") + "\n", "utf8");

for (const path of [eventPath, ingestionPath, quarantinePath, evidencePath, ...keyPaths]) {
  mkdirSync(dirname(path), { recursive: true });
}
writeFileSync(eventPath, eventBytes);
writeFileSync(ingestionPath, ingestionBytes);
writeFileSync(quarantinePath, quarantineBytes);
for (const [index, path] of keyPaths.entries()) writeFileSync(path, result.devices[index]!.publicKeyPem, { mode: 0o644 });

const rel = (path: string) => relative(repositoryRoot, path).replaceAll("\\", "/");
const hashes: Record<string, string> = {
  [rel(eventPath)]: sha256Hex(eventBytes),
  [rel(ingestionPath)]: sha256Hex(ingestionBytes),
  [rel(quarantinePath)]: sha256Hex(quarantineBytes),
};
for (const [index, path] of keyPaths.entries()) hashes[rel(path)] = sha256Hex(result.devices[index]!.publicKeyPem);
const evidence: OfflineSyncVerificationEvidence = {
  schemaVersion: SYNC_VERSION,
  identity: result.identity,
  temporal: { observedAt: result.observedAt, epochMs: result.observedAtEpochMs, timeZone: "UTC" },
  status: "VERIFIED",
  scope: {
    mode: "LOCAL_REFERENCE_SIMULATION",
    externalServices: false,
    actualNotifications: 0,
    externalSpendYen: 0,
    localHardwareAndDevelopmentCost: "UNMEASURED",
  },
  devices: result.devices.map((device, index) => ({
    label: device.label,
    deviceId: device.deviceId,
    logId: device.logId,
    keyId: device.keyId,
    publicKeyPath: rel(keyPaths[index]!),
    eventCount: device.events.length,
    checkpoint: device.checkpoint,
  })),
  observations: {
    offlineDivergenceReproduced: true,
    reconnectVerified: true,
    safeTags: result.safeTags,
    globalIngestionCount: result.ingestionRecords.length,
    deviceSequencesPreserved: true,
    duplicateIngestionDidNotAdvance: true,
    dangerousIntentSourceCount: reviews[0]!.sourceCount,
    dangerousReviewCount: reviews.length,
    dangerousDecision: "HUMAN_REVIEW_REQUIRED",
    externalEffectStarts: result.externalEffectStarts,
    globalAuditValid: true,
    ...result.faultResults,
  },
  artifacts: {
    deviceEvents: rel(eventPath),
    ingestionLedger: rel(ingestionPath),
    quarantineLedger: rel(quarantinePath),
    sha256: hashes,
  },
  requirements: ["REQ-SYNC-001", "REQ-SYNC-002", "REQ-SYNC-003", "REQ-SYNC-004"],
  limitations: {
    remoteTransport: "UNIMPLEMENTED",
    productionMultiDeviceQuality: "UNMEASURED",
    nativeWebMcpConformance: "INCONCLUSIVE",
  },
};
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n", { mode: 0o644 });
console.log(`offline sync evidence written: ${rel(evidencePath)}`);
