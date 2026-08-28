// information_uuid_v5=c039678b-c90c-5a58-9eb4-9fe2e69addac
// event_uuid_v7=01a0491b-3d0b-7d93-9362-dec4d4aa0cda
// machine-contract: SIGNED_OFFLINE -> VERIFIED_INGESTION -> SAFE_STATE_MERGED | HUMAN_REVIEW_REQUIRED; synchronization never starts an external effect.
import type { KeyObject } from "node:crypto";

export const SYNC_VERSION = "0.4.0" as const;
export const SYNC_UUID_NAMESPACE = "47f3e535-0e27-559a-9556-aa79a84f95eb";

export type DangerousEffectKind = "NOTIFICATION" | "PAYMENT" | "RESERVATION" | "DELETION";

export interface SafeTagAddOperation {
  type: "SAFE_TAG_ADD";
  setId: string;
  tag: string;
}

export interface DangerousEffectOperation {
  type: "DANGEROUS_EFFECT";
  intentId: string;
  effectKind: DangerousEffectKind;
  payloadDigest: string;
}

export type SyncOperation = SafeTagAddOperation | DangerousEffectOperation;

export interface DeviceIdentity {
  deviceId: string;
  logId: string;
  keyId: string;
}

export interface DeviceKeyMaterial {
  privateKey: KeyObject;
  publicKey: KeyObject;
}

export interface SignedDeviceEventCore {
  version: typeof SYNC_VERSION;
  eventId: string;
  occurredAt: string;
  occurredAtEpochMs: number;
  logId: string;
  deviceId: string;
  keyId: string;
  sequence: number;
  previousChainHash: string;
  operation: SyncOperation;
}

export interface SignedDeviceEvent extends SignedDeviceEventCore {
  proof: {
    algorithm: "Ed25519";
    keyId: string;
    eventDigest: string;
    chainHash: string;
    signatureBase64: string;
  };
}

export interface SignedCheckpointCore {
  version: typeof SYNC_VERSION;
  checkpointId: string;
  createdAt: string;
  createdAtEpochMs: number;
  logId: string;
  deviceId: string;
  keyId: string;
  treeSize: number;
  merkleRoot: string;
  chainHead: string;
  previousCheckpointHash: string | null;
}

export interface SignedCheckpoint extends SignedCheckpointCore {
  digest: string;
  signature: {
    algorithm: "Ed25519";
    keyId: string;
    signatureBase64: string;
  };
}

export type VerificationCode =
  | "VERIFIED"
  | "EMPTY_CHAIN"
  | "IDENTITY_MISMATCH"
  | "INVALID_UUID"
  | "EVENT_TIME_MISMATCH"
  | "SEQUENCE_GAP"
  | "CHAIN_MISMATCH"
  | "DIGEST_MISMATCH"
  | "INVALID_SIGNATURE"
  | "CHECKPOINT_MISMATCH";

export type DeviceChainVerification =
  | { valid: true; code: "VERIFIED"; eventCount: number; chainHead: string; merkleRoot: string }
  | { valid: false; code: Exclude<VerificationCode, "VERIFIED">; eventCount: number; message: string };

export type QuarantineCode =
  | Exclude<VerificationCode, "VERIFIED">
  | "UNKNOWN_KEY"
  | "FORK_DETECTED";

export type IngestionDecision = "MERGED_SAFE_STATE" | "HUMAN_REVIEW_REQUIRED";

export interface GlobalIngestionRecordCore {
  version: typeof SYNC_VERSION;
  ingestionEventId: string;
  ingestedAt: string;
  ingestedAtEpochMs: number;
  globalSequence: number;
  previousGlobalHash: string;
  deviceId: string;
  deviceSequence: number;
  sourceEventId: string;
  sourceEventDigest: string;
  sourceChainHash: string;
  operation: SyncOperation;
  decision: IngestionDecision;
}

export interface GlobalIngestionRecord extends GlobalIngestionRecordCore {
  globalHash: string;
}

export interface QuarantineRecord {
  version: typeof SYNC_VERSION;
  quarantineId: string;
  occurredAt: string;
  occurredAtEpochMs: number;
  code: QuarantineCode;
  deviceId: string | null;
  deviceSequence: number | null;
  observedDigest: string;
  state: "REJECTED";
  externalEffectStarts: 0;
}

export interface DangerousReview {
  intentId: string;
  effectKind: DangerousEffectKind;
  payloadDigest: string;
  status: "HUMAN_REVIEW_REQUIRED";
  sourceCount: number;
  conflictingPayloads: boolean;
}

export type IngestResult =
  | { status: "INGESTED"; records: readonly GlobalIngestionRecord[] }
  | { status: "DUPLICATE"; records: readonly GlobalIngestionRecord[] }
  | { status: "QUARANTINED"; code: QuarantineCode; quarantine: QuarantineRecord };

export interface DevicePublicEvidence {
  label: string;
  deviceId: string;
  logId: string;
  keyId: string;
  publicKeyPath: string;
  eventCount: number;
  checkpoint: SignedCheckpoint;
}

export interface OfflineSyncVerificationEvidence {
  schemaVersion: typeof SYNC_VERSION;
  identity: {
    uuidV5: string;
    uuidV7: string;
    uuidNamespace: string;
  };
  temporal: {
    observedAt: string;
    epochMs: number;
    timeZone: "UTC";
  };
  status: "VERIFIED";
  scope: {
    mode: "LOCAL_REFERENCE_SIMULATION";
    externalServices: false;
    actualNotifications: 0;
    externalSpendYen: 0;
    localHardwareAndDevelopmentCost: "UNMEASURED";
  };
  devices: readonly DevicePublicEvidence[];
  observations: {
    offlineDivergenceReproduced: true;
    reconnectVerified: true;
    safeTags: readonly string[];
    globalIngestionCount: number;
    deviceSequencesPreserved: true;
    duplicateIngestionDidNotAdvance: true;
    dangerousIntentSourceCount: number;
    dangerousReviewCount: number;
    dangerousDecision: "HUMAN_REVIEW_REQUIRED";
    externalEffectStarts: 0;
    globalAuditValid: true;
    signatureTamperRejected: "INVALID_SIGNATURE";
    sequenceGapRejected: "SEQUENCE_GAP";
    forkRejected: "FORK_DETECTED";
    checkpointMismatchRejected: "CHECKPOINT_MISMATCH";
  };
  artifacts: {
    deviceEvents: string;
    ingestionLedger: string;
    quarantineLedger: string;
    sha256: Readonly<Record<string, string>>;
  };
  requirements: readonly ["REQ-SYNC-001", "REQ-SYNC-002", "REQ-SYNC-003", "REQ-SYNC-004"];
  limitations: {
    remoteTransport: "UNIMPLEMENTED";
    productionMultiDeviceQuality: "UNMEASURED";
    nativeWebMcpConformance: "INCONCLUSIVE";
  };
}
