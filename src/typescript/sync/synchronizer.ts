// information_uuid_v5=86f82995-5b21-5d8a-ba1d-d26329db64d6
// event_uuid_v7=01a0491b-3dba-7e97-ba92-5d4a2509759c
// machine-contract: UNTRUSTED_BATCH -> VERIFIED -> INGESTED | DUPLICATE | QUARANTINED; this boundary has no external-effect execution capability.
// information_uuid_v5=3a0187cc-7497-5325-a2ad-3df91330e778
// event_uuid_v7=01a049ff-0159-7193-b343-dc803d80f4e0
// state_transition=DISCOVERED -> EXECUTING occurred_at=2026-08-28T20:10:43.929Z
// machine-contract: every unsigned global projection is re-bound to the stored signed source event before the global chain can verify.
// information_uuid_v5=4d52b526-114b-5826-8d53-ab6e4dadc476
// event_uuid_v7=01a04a1b-eac6-7c5c-aa43-c19d4a593bfb
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T20:42:18.694Z
// machine-contract: legacy rows report a signed-source rebind requirement and verified duplicate ingestion repairs them without advancing the global sequence.
// information_uuid_v5=e7c27b84-7f90-5d05-b838-d5467ac7ee41
// information_uuid_v5=b7c65009-e07f-5668-8618-1b8cff72fa1a
// event_uuid_v7=01a04a2c-246b-7e0e-bc66-2a7ff653aef0
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:00:02.027Z
// machine-contract: the signed operation determines the decision, and every duplicated SQLite identity column must equal the canonical audit record.
// information_uuid_v5=62165297-6dec-5f97-a77b-3eb1892678eb
// event_uuid_v7=01a04a3b-7a18-7745-9b09-d8e5a2a74866
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:16:47.000Z
// machine-contract: individually valid source signatures verify as a complete device chain against every stored full-size signed checkpoint.
// information_uuid_v5=6bf6cd1e-2220-5770-a630-6bb7eeb0c1ee
// event_uuid_v7=01a04a4c-1be8-7fcc-a67f-5eaff2cc8030
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:34:57.000Z
// machine-contract: every retained checkpoint verifies its signed event prefix, and retained checkpoint links form one nonbranching monotonic chain.
// information_uuid_v5=c2e27d1a-220f-5c4a-b6f6-7075bf2c5733
// event_uuid_v7=01a04a5a-ece0-7715-a44c-3fe4200880af
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:51:08.000Z
// machine-contract: only an explicitly null parent creates a checkpoint root; a non-null parent missing from the retained ledger invalidates verification.
// information_uuid_v5=133e9b91-5738-5e1c-8bcd-567a65bba243
// event_uuid_v7=01a04a5f-6d38-7fc8-89b3-1e7daabc661d
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:56:03.000Z
// machine-contract: a database key is trusted only when its identity and normalized public-key digest match the separately persisted trust anchor.
// information_uuid_v5=5873e905-b4fe-5cbf-b23e-e92d10068f7b
// event_uuid_v7=01a04c90-aedf-7a0d-bb62-fe99a19ae1c3
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-29T08:09:05.503Z
// machine-contract: the first retained checkpoint may omit one signed parent only when its own digest is fixed in the external trust anchor; every later parent link remains mandatory.
// information_uuid_v5=542c5141-881b-506e-af3b-fa3f25439622
// event_uuid_v7=01a04c90-aee0-7b99-9581-fa55957b08f4
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-29T08:09:05.504Z
// machine-contract: external trust-anchor changes serialize lock -> reread -> validate -> merge -> atomic replace, so stale ledger instances cannot remove accepted keys.
// information_uuid_v5=adafdf1a-7adc-5cc3-948f-b87cc011e114
// event_uuid_v7=01a04c90-aee1-7e37-a797-81c25dc4b222
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-29T08:09:05.505Z
// machine-contract: LEGACY_WITHOUT_ANCHOR -> EXPLICIT_TRUST_INPUT -> ANCHOR_MIGRATED; database key rows alone never establish trust.
// information_uuid_v5=42e6c608-b379-5459-acbb-dcda225e299a
// event_uuid_v7=01a04cfe-b736-7157-bac8-18998bd6d378
// state_transition=REVIEW -> EXECUTING occurred_at=2026-08-29T10:10:51.894Z
// machine-contract: UNINITIALIZED -> OWNED -> RELEASED; only a dead owner or an expired uninitialized lock may transition through RECOVERED, and a live owner is never displaced.
// information_uuid_v5=bb68a2be-afd2-5e87-84b0-5c0e1ff62114
// event_uuid_v7=01a04d10-b64b-7db3-b253-c3d1551dffac
// state_transition=ROLLBACK_SPLIT -> RESTORED | CRASH_RECOVERABLE occurred_at=2026-08-29T10:30:33.867Z
// machine-contract: BOOTSTRAP_ANCHOR_WRITTEN -> SQLITE_COMMITTED advances both stores; a caught rollback restores the verified prior anchor, while a process death leaves only a fail-closed same-checkpoint recovery path.
// information_uuid_v5=4d626686-1080-5bdd-99c8-0db45b28a429
// event_uuid_v7=01a04d19-f9ee-7c91-8f32-123033bb1b34
// state_transition=PATH_CHECK_THEN_OPEN -> DESCRIPTOR_VERIFIED_READ occurred_at=2026-08-29T10:40:43.886Z
// machine-contract: owner.json is opened once with O_NOFOLLOW, classified from that descriptor, and read from that same descriptor; no path observation authorizes later owner bytes.
import { createPublicKey } from "node:crypto";
import { closeSync, constants, existsSync, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { isUuidVersion, uuidV7 } from "../uuid.ts";
import { globalGenesisHash, globalRecordHash, sha256Hex } from "./crypto.ts";
import { verifyDeviceChain, verifySignedDeviceEvent } from "./device-log.ts";
import {
  SYNC_VERSION,
  type DangerousReview,
  type DeviceIdentity,
  type GlobalIngestionRecord,
  type GlobalIngestionRecordCore,
  type IngestResult,
  type IngestionDecision,
  type QuarantineCode,
  type QuarantineRecord,
  type SignedCheckpoint,
  type SignedDeviceEvent,
} from "./types.ts";

interface KnownKeyRow {
  device_id: string;
  log_id: string;
  key_id: string;
  public_key_pem: string;
}

interface TrustedDeviceKeyAnchor {
  deviceId: string;
  logId: string;
  keyId: string;
  publicKeySha256: string;
  bootstrapCheckpointDigest: string | null;
}

interface TrustedKeyAnchorLockOwner {
  schemaVersion: 1;
  ownerProcessId: number;
  acquiredAtEpochMs: number;
  ownerEventId: string;
}

interface TrustedKeyAnchorLockObservation {
  directoryIdentity: string;
  fingerprint: string;
  owner: TrustedKeyAnchorLockOwner | null;
  recoverable: boolean;
}

interface TrustedKeyAnchorRecoveryClaim {
  path: string;
  owner: TrustedKeyAnchorLockOwner;
}

const SHA_256 = /^[0-9a-f]{64}$/;
const TRUST_ANCHOR_FILE_FIELDS = ["schemaVersion", "digestAlgorithm", "anchors"] as const;
const LEGACY_TRUST_ANCHOR_FIELDS = ["deviceId", "logId", "keyId", "publicKeySha256"] as const;
const TRUST_ANCHOR_FIELDS = [...LEGACY_TRUST_ANCHOR_FIELDS, "bootstrapCheckpointDigest"] as const;
const TRUST_ANCHOR_LOCK_TIMEOUT_MS = 5_000;
const TRUST_ANCHOR_LOCK_RETRY_MS = 10;
const TRUST_ANCHOR_LOCK_UNINITIALIZED_GRACE_MS = 1_000;
const TRUST_ANCHOR_LOCK_OWNER_FILE = "owner.json";
const TRUST_ANCHOR_LOCK_OWNER_FIELDS = ["schemaVersion", "ownerProcessId", "acquiredAtEpochMs", "ownerEventId"] as const;
const TRUST_ANCHOR_LOCK_WAIT = new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT));

function hasExactFields(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((key) => fields.includes(key))
  );
}

export function trustAnchorPathForDatabase(databasePath: string): string | null {
  return databasePath === ":memory:" ? null : `${databasePath}.trusted-keys.json`;
}

function filesystemErrorCode(error: unknown): string | null {
  if (error === null || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function readTrustedKeyAnchorLockOwner(lockPath: string): TrustedKeyAnchorLockOwner | null {
  const ownerPath = join(lockPath, TRUST_ANCHOR_LOCK_OWNER_FILE);
  let descriptor: number | null = null;
  let ownerText: string;
  try {
    descriptor = openSync(ownerPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    if (!fstatSync(descriptor).isFile()) throw new Error("trusted device key anchor lock owner must be a regular file");
    ownerText = readFileSync(descriptor, "utf8");
  } catch (error) {
    if (filesystemErrorCode(error) === "ENOENT") return null;
    if (filesystemErrorCode(error) === "ELOOP") {
      throw new Error("trusted device key anchor lock owner must be a regular file", { cause: error });
    }
    throw error;
  } finally {
    if (descriptor !== null) closeSync(descriptor);
  }
  let value: unknown;
  try {
    value = JSON.parse(ownerText);
  } catch {
    return null;
  }
  if (
    !hasExactFields(value, TRUST_ANCHOR_LOCK_OWNER_FIELDS) ||
    value.schemaVersion !== 1 ||
    !Number.isSafeInteger(value.ownerProcessId) ||
    (value.ownerProcessId as number) < 1 ||
    !Number.isSafeInteger(value.acquiredAtEpochMs) ||
    (value.acquiredAtEpochMs as number) < 0 ||
    typeof value.ownerEventId !== "string" ||
    !isUuidVersion(value.ownerEventId, 7)
  )
    return null;
  return value as unknown as TrustedKeyAnchorLockOwner;
}

function processIsDefinitelyDead(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return false;
  } catch (error) {
    return filesystemErrorCode(error) === "ESRCH";
  }
}

function createTrustedKeyAnchorLockOwner(): TrustedKeyAnchorLockOwner {
  const acquiredAtEpochMs = Date.now();
  return {
    schemaVersion: 1,
    ownerProcessId: process.pid,
    acquiredAtEpochMs,
    ownerEventId: uuidV7(acquiredAtEpochMs),
  };
}

function writeTrustedKeyAnchorLockOwner(lockPath: string, owner: TrustedKeyAnchorLockOwner): void {
  writeFileSync(join(lockPath, TRUST_ANCHOR_LOCK_OWNER_FILE), `${JSON.stringify(owner)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

function trustedKeyAnchorLockIsOwnedBy(lockPath: string, owner: TrustedKeyAnchorLockOwner): boolean {
  const currentOwner = readTrustedKeyAnchorLockOwner(lockPath);
  return currentOwner?.ownerProcessId === owner.ownerProcessId && currentOwner.ownerEventId === owner.ownerEventId;
}

function observeTrustedKeyAnchorLock(lockPath: string, nowEpochMs: number): TrustedKeyAnchorLockObservation | null {
  let lockStats;
  try {
    lockStats = lstatSync(lockPath);
  } catch (error) {
    if (filesystemErrorCode(error) === "ENOENT") return null;
    throw error;
  }
  if (!lockStats.isDirectory() || lockStats.isSymbolicLink()) {
    const directoryIdentity = `unsafe-${lockStats.dev}-${lockStats.ino}`;
    return { directoryIdentity, fingerprint: directoryIdentity, owner: null, recoverable: false };
  }
  const owner = readTrustedKeyAnchorLockOwner(lockPath);
  const directoryIdentity = `${lockStats.dev}-${lockStats.ino}`;
  return {
    directoryIdentity,
    fingerprint: `${directoryIdentity}-${owner?.ownerEventId ?? "uninitialized"}`,
    owner,
    recoverable: owner === null ? nowEpochMs - lockStats.mtimeMs >= TRUST_ANCHOR_LOCK_UNINITIALIZED_GRACE_MS : processIsDefinitelyDead(owner.ownerProcessId),
  };
}

function tryAcquireTrustedKeyAnchorRecoveryClaim(lockPath: string, directoryIdentity: string): TrustedKeyAnchorRecoveryClaim | null {
  const recoveryClaimPath = `${lockPath}.recovery-${sha256Hex(directoryIdentity)}`;
  let recoveryOwner: TrustedKeyAnchorLockOwner;
  try {
    mkdirSync(recoveryClaimPath, { mode: 0o700 });
    recoveryOwner = createTrustedKeyAnchorLockOwner();
    try {
      writeTrustedKeyAnchorLockOwner(recoveryClaimPath, recoveryOwner);
    } catch (error) {
      throw error;
    }
  } catch (error) {
    if (filesystemErrorCode(error) === "EEXIST") {
      const abandonedClaim = observeTrustedKeyAnchorLock(recoveryClaimPath, Date.now());
      if (abandonedClaim?.recoverable) rmSync(recoveryClaimPath, { recursive: true, force: true });
      return null;
    }
    throw error;
  }
  return { path: recoveryClaimPath, owner: recoveryOwner };
}

function releaseTrustedKeyAnchorRecoveryClaim(claim: TrustedKeyAnchorRecoveryClaim): void {
  if (trustedKeyAnchorLockIsOwnedBy(claim.path, claim.owner)) {
    rmSync(claim.path, { recursive: true, force: false });
  }
}

function tryRecoverTrustedKeyAnchorLock(lockPath: string, nowEpochMs: number): boolean {
  const observed = observeTrustedKeyAnchorLock(lockPath, nowEpochMs);
  if (!observed?.recoverable) return false;
  const recoveryClaim = tryAcquireTrustedKeyAnchorRecoveryClaim(lockPath, observed.directoryIdentity);
  if (recoveryClaim === null) return false;
  try {
    const current = observeTrustedKeyAnchorLock(lockPath, Date.now());
    if (!current?.recoverable || current.fingerprint !== observed.fingerprint) return false;
    rmSync(lockPath, { recursive: true, force: false });
    return true;
  } finally {
    releaseTrustedKeyAnchorRecoveryClaim(recoveryClaim);
  }
}

function cleanupFailedTrustedKeyAnchorLockInitialization(lockPath: string, createdDirectoryIdentity: string, attemptedOwner: TrustedKeyAnchorLockOwner): void {
  const recoveryClaim = tryAcquireTrustedKeyAnchorRecoveryClaim(lockPath, createdDirectoryIdentity);
  if (recoveryClaim === null) return;
  try {
    const current = observeTrustedKeyAnchorLock(lockPath, Date.now());
    if (
      current?.directoryIdentity === createdDirectoryIdentity &&
      (current.owner === null || (current.owner.ownerProcessId === attemptedOwner.ownerProcessId && current.owner.ownerEventId === attemptedOwner.ownerEventId))
    )
      rmSync(lockPath, { recursive: true, force: false });
  } finally {
    releaseTrustedKeyAnchorRecoveryClaim(recoveryClaim);
  }
}

function withTrustedKeyAnchorLock<T>(path: string, timeoutMs: number, afterDirectoryCreated: ((lockPath: string) => void) | undefined, operation: () => T): T {
  const lockPath = `${path}.lock`;
  const deadline = Date.now() + timeoutMs;
  let owner: TrustedKeyAnchorLockOwner | null = null;
  let ownerFingerprint: string | null = null;
  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 });
      const createdDirectoryIdentity = observeTrustedKeyAnchorLock(lockPath, Date.now())?.directoryIdentity;
      if (createdDirectoryIdentity === undefined) {
        throw new Error("trusted device key anchor lock directory identity is unreadable");
      }
      owner = createTrustedKeyAnchorLockOwner();
      try {
        afterDirectoryCreated?.(lockPath);
        writeTrustedKeyAnchorLockOwner(lockPath, owner);
        ownerFingerprint = observeTrustedKeyAnchorLock(lockPath, Date.now())?.fingerprint ?? null;
        if (ownerFingerprint === null) throw new Error("trusted device key anchor lock identity is unreadable");
      } catch (error) {
        cleanupFailedTrustedKeyAnchorLockInitialization(lockPath, createdDirectoryIdentity, owner);
        throw error;
      }
      break;
    } catch (error) {
      if (filesystemErrorCode(error) !== "EEXIST") throw error;
      if (tryRecoverTrustedKeyAnchorLock(lockPath, Date.now())) continue;
      if (Date.now() >= deadline) {
        throw new Error("timed out waiting for the trusted device key anchor lock", { cause: error });
      }
      Atomics.wait(TRUST_ANCHOR_LOCK_WAIT, 0, 0, TRUST_ANCHOR_LOCK_RETRY_MS);
    }
  }
  try {
    return operation();
  } finally {
    const currentFingerprint = observeTrustedKeyAnchorLock(lockPath, Date.now())?.fingerprint ?? null;
    if (owner !== null && ownerFingerprint !== null && currentFingerprint === ownerFingerprint && trustedKeyAnchorLockIsOwnedBy(lockPath, owner)) {
      rmSync(lockPath, { recursive: true, force: false });
    } else {
      throw new Error("trusted device key anchor lock ownership changed before release");
    }
  }
}

function readTrustedKeyAnchors(path: string | null): Map<string, TrustedDeviceKeyAnchor> {
  if (path === null || !existsSync(path)) return new Map();
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("trusted device key anchor file is unreadable");
  }
  if (
    !hasExactFields(value, TRUST_ANCHOR_FILE_FIELDS) ||
    value.schemaVersion !== SYNC_VERSION ||
    value.digestAlgorithm !== "SHA-256" ||
    !Array.isArray(value.anchors)
  )
    throw new Error("trusted device key anchor file has an invalid contract");
  const anchors = new Map<string, TrustedDeviceKeyAnchor>();
  const logIds = new Set<string>();
  const keyIds = new Set<string>();
  for (const item of value.anchors) {
    if (
      !(hasExactFields(item, TRUST_ANCHOR_FIELDS) || hasExactFields(item, LEGACY_TRUST_ANCHOR_FIELDS)) ||
      typeof item.deviceId !== "string" ||
      typeof item.logId !== "string" ||
      typeof item.keyId !== "string" ||
      typeof item.publicKeySha256 !== "string" ||
      ("bootstrapCheckpointDigest" in item &&
        item.bootstrapCheckpointDigest !== null &&
        (typeof item.bootstrapCheckpointDigest !== "string" || !SHA_256.test(item.bootstrapCheckpointDigest))) ||
      ![item.deviceId, item.logId, item.keyId].every((identifier) => isUuidVersion(identifier, 5)) ||
      !SHA_256.test(item.publicKeySha256) ||
      anchors.has(item.deviceId) ||
      logIds.has(item.logId) ||
      keyIds.has(item.keyId)
    )
      throw new Error("trusted device key anchor file contains an invalid or duplicate entry");
    const anchor = {
      deviceId: item.deviceId,
      logId: item.logId,
      keyId: item.keyId,
      publicKeySha256: item.publicKeySha256,
      bootstrapCheckpointDigest: "bootstrapCheckpointDigest" in item ? (item.bootstrapCheckpointDigest as string | null) : null,
    };
    anchors.set(anchor.deviceId, anchor);
    logIds.add(anchor.logId);
    keyIds.add(anchor.keyId);
  }
  return anchors;
}

function normalizedTrustedDeviceAnchor(
  identity: DeviceIdentity,
  publicKeyPem: string,
): {
  anchor: TrustedDeviceKeyAnchor;
  normalizedPublicKeyPem: string;
} {
  if (![identity.deviceId, identity.logId, identity.keyId].every((value) => isUuidVersion(value, 5))) {
    throw new TypeError("registered device identity must use UUIDv5");
  }
  const publicKey = createPublicKey(publicKeyPem);
  if (publicKey.asymmetricKeyType !== "ed25519") throw new TypeError("registered key must be Ed25519");
  const normalizedPublicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return {
    anchor: {
      deviceId: identity.deviceId,
      logId: identity.logId,
      keyId: identity.keyId,
      publicKeySha256: sha256Hex(normalizedPublicKeyPem),
      bootstrapCheckpointDigest: null,
    },
    normalizedPublicKeyPem,
  };
}

function baseTrustMaterialMatches(left: TrustedDeviceKeyAnchor, right: TrustedDeviceKeyAnchor): boolean {
  return left.deviceId === right.deviceId && left.logId === right.logId && left.keyId === right.keyId && left.publicKeySha256 === right.publicKeySha256;
}

function assertAnchorCanBeAdded(anchors: ReadonlyMap<string, TrustedDeviceKeyAnchor>, requestedAnchor: TrustedDeviceKeyAnchor): void {
  const anchored = anchors.get(requestedAnchor.deviceId);
  if (anchored && !baseTrustMaterialMatches(anchored, requestedAnchor)) {
    throw new Error("device identity is already bound to different external trust material");
  }
  if (
    !anchored &&
    [...anchors.values()].some((anchor) => {
      return anchor.logId === requestedAnchor.logId || anchor.keyId === requestedAnchor.keyId;
    })
  )
    throw new Error("device log or key identity is already externally anchored");
}

export interface LegacyTrustedDeviceInput {
  identity: DeviceIdentity;
  publicKeyPem: string;
}

export interface LocalSyncLedgerOptions {
  now?: () => number;
  trustAnchorPath?: string;
  legacyTrustMigration?: readonly LegacyTrustedDeviceInput[];
  trustAnchorLockTimeoutMs?: number;
  afterTrustAnchorLockDirectoryCreated?: (lockPath: string) => void;
}

interface EventRow {
  device_id: string;
  device_sequence: number;
  source_event_id: string;
  source_chain_hash: string;
  source_event_digest: string;
  source_event_json: string | null;
}

interface CheckpointRow {
  checkpoint_digest: string;
  tree_size: number;
}

interface CheckpointMembershipRow {
  device_id: string;
  checkpoint_digest: string;
  tree_size: number;
  chain_head: string;
  previous_checkpoint_hash: string | null;
  checkpoint_json: string;
}

interface IngestionAuditRow {
  global_sequence: number;
  ingestion_event_id: string;
  ingested_at: number;
  device_id: string;
  device_sequence: number;
  source_event_id: string;
  source_event_digest: string;
  source_chain_hash: string;
  source_event_json: string | null;
  decision: IngestionDecision;
  previous_global_hash: string;
  global_hash: string;
}

function nowIso(epochMs: number): string {
  return new Date(epochMs).toISOString();
}

export class LocalSyncLedger {
  readonly database: DatabaseSync;
  readonly #now: () => number;
  readonly #trustAnchorPath: string | null;
  readonly #trustAnchorLockTimeoutMs: number;
  readonly #afterTrustAnchorLockDirectoryCreated: ((lockPath: string) => void) | undefined;
  readonly #trustedKeyAnchors: Map<string, TrustedDeviceKeyAnchor>;
  #anchorWriteSequence = 0;

  constructor(path: string, options: LocalSyncLedgerOptions = {}) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.#now = options.now ?? Date.now;
    this.#trustAnchorLockTimeoutMs = options.trustAnchorLockTimeoutMs ?? TRUST_ANCHOR_LOCK_TIMEOUT_MS;
    if (!Number.isSafeInteger(this.#trustAnchorLockTimeoutMs) || this.#trustAnchorLockTimeoutMs < 1) {
      throw new TypeError("trust anchor lock timeout must be a positive integer number of milliseconds");
    }
    this.#afterTrustAnchorLockDirectoryCreated = options.afterTrustAnchorLockDirectoryCreated;
    if (this.#afterTrustAnchorLockDirectoryCreated !== undefined && typeof this.#afterTrustAnchorLockDirectoryCreated !== "function")
      throw new TypeError("trust anchor lock directory hook must be a function");
    this.#trustAnchorPath = options.trustAnchorPath ?? trustAnchorPathForDatabase(path);
    if (this.#trustAnchorPath !== null && (this.#trustAnchorPath.length === 0 || (path !== ":memory:" && resolve(this.#trustAnchorPath) === resolve(path))))
      throw new TypeError("trust anchor path must be a separate file");
    if (this.#trustAnchorPath !== null) mkdirSync(dirname(this.#trustAnchorPath), { recursive: true });
    this.#trustedKeyAnchors = readTrustedKeyAnchors(this.#trustAnchorPath);
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS known_device_keys (
        device_id TEXT PRIMARY KEY,
        log_id TEXT NOT NULL UNIQUE,
        key_id TEXT NOT NULL UNIQUE,
        public_key_pem TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ingestion_events (
        global_sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        ingestion_event_id TEXT NOT NULL UNIQUE,
        ingested_at INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        device_sequence INTEGER NOT NULL,
        source_event_id TEXT NOT NULL UNIQUE,
        source_event_digest TEXT NOT NULL,
        source_chain_hash TEXT NOT NULL,
        source_event_json TEXT,
        decision TEXT NOT NULL CHECK (decision IN ('MERGED_SAFE_STATE', 'HUMAN_REVIEW_REQUIRED')),
        previous_global_hash TEXT NOT NULL,
        global_hash TEXT NOT NULL UNIQUE,
        record_json TEXT NOT NULL,
        UNIQUE(device_id, device_sequence)
      );
      CREATE TABLE IF NOT EXISTS device_checkpoints (
        device_id TEXT NOT NULL,
        checkpoint_digest TEXT NOT NULL UNIQUE,
        tree_size INTEGER NOT NULL,
        chain_head TEXT NOT NULL,
        previous_checkpoint_hash TEXT,
        checkpoint_json TEXT NOT NULL,
        PRIMARY KEY(device_id, checkpoint_digest)
      );
      CREATE INDEX IF NOT EXISTS device_checkpoint_order
        ON device_checkpoints(device_id, tree_size);
      CREATE TABLE IF NOT EXISTS safe_tags (
        set_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        first_source_event_digest TEXT NOT NULL,
        PRIMARY KEY(set_id, tag)
      );
      CREATE TABLE IF NOT EXISTS dangerous_reviews (
        intent_id TEXT PRIMARY KEY,
        effect_kind TEXT NOT NULL,
        payload_digest TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status = 'HUMAN_REVIEW_REQUIRED'),
        source_count INTEGER NOT NULL,
        conflicting_payloads INTEGER NOT NULL CHECK (conflicting_payloads IN (0, 1))
      );
      CREATE TABLE IF NOT EXISTS dangerous_review_sources (
        intent_id TEXT NOT NULL REFERENCES dangerous_reviews(intent_id),
        source_event_digest TEXT NOT NULL UNIQUE,
        device_id TEXT NOT NULL,
        device_sequence INTEGER NOT NULL,
        PRIMARY KEY(intent_id, source_event_digest)
      );
      CREATE TABLE IF NOT EXISTS quarantine (
        quarantine_id TEXT PRIMARY KEY,
        occurred_at INTEGER NOT NULL,
        code TEXT NOT NULL,
        device_id TEXT,
        device_sequence INTEGER,
        observed_digest TEXT NOT NULL,
        record_json TEXT NOT NULL
      );
    `);
    const ingestionColumns = this.database.prepare("PRAGMA table_info(ingestion_events)").all() as { name: string }[];
    if (!ingestionColumns.some((column) => column.name === "source_event_json")) {
      this.database.exec("ALTER TABLE ingestion_events ADD COLUMN source_event_json TEXT");
    }
    const knownDeviceCount = Number((this.database.prepare("SELECT count(*) AS value FROM known_device_keys").get() as { value: number }).value);
    try {
      if (options.legacyTrustMigration !== undefined) {
        this.#migrateLegacyTrustAnchors(options.legacyTrustMigration);
      } else if (knownDeviceCount > 0 && (this.#trustAnchorPath === null || !existsSync(this.#trustAnchorPath))) {
        throw new Error("legacy trusted device keys require explicit trust migration input");
      }
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }

  #replaceTrustedKeyAnchors(anchors: ReadonlyMap<string, TrustedDeviceKeyAnchor>): void {
    this.#trustedKeyAnchors.clear();
    for (const [deviceId, anchor] of anchors) this.#trustedKeyAnchors.set(deviceId, { ...anchor });
  }

  #writeTrustedKeyAnchors(anchors: ReadonlyMap<string, TrustedDeviceKeyAnchor>): void {
    if (this.#trustAnchorPath === null) return;
    const contents =
      JSON.stringify(
        {
          schemaVersion: SYNC_VERSION,
          digestAlgorithm: "SHA-256",
          anchors: [...anchors.values()].sort((left, right) => left.deviceId.localeCompare(right.deviceId)),
        },
        null,
        2,
      ) + "\n";
    const temporaryPath = `${this.#trustAnchorPath}.${process.pid}.${this.#anchorWriteSequence++}.tmp`;
    writeFileSync(temporaryPath, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
    try {
      renameSync(temporaryPath, this.#trustAnchorPath);
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      throw error;
    }
  }

  #updateTrustedKeyAnchors<T>(operation: (anchors: Map<string, TrustedDeviceKeyAnchor>) => { changed: boolean; value: T }): T {
    const update = (): T => {
      const anchors =
        this.#trustAnchorPath === null
          ? new Map([...this.#trustedKeyAnchors].map(([deviceId, anchor]) => [deviceId, { ...anchor }]))
          : readTrustedKeyAnchors(this.#trustAnchorPath);
      const result = operation(anchors);
      if (result.changed) this.#writeTrustedKeyAnchors(anchors);
      this.#replaceTrustedKeyAnchors(anchors);
      return result.value;
    };
    return this.#trustAnchorPath === null
      ? update()
      : withTrustedKeyAnchorLock(this.#trustAnchorPath, this.#trustAnchorLockTimeoutMs, this.#afterTrustAnchorLockDirectoryCreated, update);
  }

  #refreshTrustedKeyAnchors(): void {
    if (this.#trustAnchorPath !== null) this.#replaceTrustedKeyAnchors(readTrustedKeyAnchors(this.#trustAnchorPath));
  }

  #migrateLegacyTrustAnchors(inputs: readonly LegacyTrustedDeviceInput[]): void {
    if (this.#trustAnchorPath === null) throw new Error("legacy trust migration requires a separate trust anchor file");
    const knownRows = this.database
      .prepare(`
      SELECT device_id, log_id, key_id, public_key_pem FROM known_device_keys ORDER BY device_id
    `)
      .all() as unknown as KnownKeyRow[];
    if (knownRows.length === 0) throw new Error("legacy trust migration requires existing trusted device rows");

    const requestedAnchors = new Map<string, TrustedDeviceKeyAnchor>();
    for (const input of inputs) {
      const { anchor, normalizedPublicKeyPem } = normalizedTrustedDeviceAnchor(input.identity, input.publicKeyPem);
      assertAnchorCanBeAdded(requestedAnchors, anchor);
      if (requestedAnchors.has(anchor.deviceId)) throw new Error("legacy trust migration contains a duplicate device");
      const known = knownRows.find((row) => row.device_id === anchor.deviceId);
      if (!known || known.log_id !== anchor.logId || known.key_id !== anchor.keyId || known.public_key_pem !== normalizedPublicKeyPem)
        throw new Error("legacy trust migration input does not match the stored device identity and key");
      requestedAnchors.set(anchor.deviceId, anchor);
    }
    if (requestedAnchors.size !== knownRows.length) {
      throw new Error("legacy trust migration must explicitly cover every stored device key");
    }

    this.#updateTrustedKeyAnchors((anchors) => {
      if (anchors.size > 0) {
        if (
          anchors.size !== requestedAnchors.size ||
          [...requestedAnchors].some(([deviceId, requested]) => {
            const current = anchors.get(deviceId);
            return !current || !baseTrustMaterialMatches(current, requested);
          })
        )
          throw new Error("legacy trust migration conflicts with the existing external trust anchor");
        return { changed: false, value: undefined };
      }
      for (const [deviceId, requested] of requestedAnchors) anchors.set(deviceId, requested);
      return { changed: true, value: undefined };
    });
  }

  #knownKeyMatchesAnchor(known: KnownKeyRow, anchors: ReadonlyMap<string, TrustedDeviceKeyAnchor> = this.#trustedKeyAnchors): boolean {
    const anchor = anchors.get(known.device_id);
    return Boolean(anchor && anchor.logId === known.log_id && anchor.keyId === known.key_id && anchor.publicKeySha256 === sha256Hex(known.public_key_pem));
  }

  registerDevice(identity: DeviceIdentity, publicKeyPem: string): void {
    const { anchor: requestedAnchor, normalizedPublicKeyPem } = normalizedTrustedDeviceAnchor(identity, publicKeyPem);
    const existing = this.database.prepare("SELECT * FROM known_device_keys WHERE device_id = ?").get(identity.deviceId) as KnownKeyRow | undefined;
    if (existing) {
      if (existing.log_id !== identity.logId || existing.key_id !== identity.keyId || existing.public_key_pem !== normalizedPublicKeyPem)
        throw new Error("device identity is already bound to different key material");
    }
    this.#updateTrustedKeyAnchors((anchors) => {
      assertAnchorCanBeAdded(anchors, requestedAnchor);
      if (anchors.has(requestedAnchor.deviceId)) return { changed: false, value: undefined };
      anchors.set(requestedAnchor.deviceId, requestedAnchor);
      return { changed: true, value: undefined };
    });
    if (existing) return;
    try {
      this.database
        .prepare(`
        INSERT INTO known_device_keys (device_id, log_id, key_id, public_key_pem) VALUES (?, ?, ?, ?)
      `)
        .run(identity.deviceId, identity.logId, identity.keyId, normalizedPublicKeyPem);
    } catch (error) {
      const concurrentlyInserted = this.database.prepare("SELECT * FROM known_device_keys WHERE device_id = ?").get(identity.deviceId) as
        | KnownKeyRow
        | undefined;
      if (
        concurrentlyInserted?.log_id === identity.logId &&
        concurrentlyInserted.key_id === identity.keyId &&
        concurrentlyInserted.public_key_pem === normalizedPublicKeyPem
      )
        return;
      throw error;
    }
  }

  ingest(events: readonly SignedDeviceEvent[], checkpoint: SignedCheckpoint): IngestResult {
    if (events.length === 0) return this.quarantine("EMPTY_CHAIN", null, null, checkpoint.digest);
    const first = events[0]!;
    const ingestUnderSerializedBoundary = (): IngestResult => {
      const anchors =
        this.#trustAnchorPath === null
          ? new Map([...this.#trustedKeyAnchors].map(([deviceId, anchor]) => [deviceId, { ...anchor }]))
          : readTrustedKeyAnchors(this.#trustAnchorPath);
      const originalAnchors = new Map([...anchors].map(([deviceId, anchor]) => [deviceId, { ...anchor }]));
      let bootstrapAnchorPersisted = false;
      let result: IngestResult;
      try {
        result = this.transaction<IngestResult>(() => {
          const known = this.database.prepare("SELECT * FROM known_device_keys WHERE device_id = ?").get(first.deviceId) as KnownKeyRow | undefined;
          if (!known) return this.quarantine("UNKNOWN_KEY", first.deviceId, first.sequence, first.proof.eventDigest);
          if (!this.#knownKeyMatchesAnchor(known, anchors)) {
            return this.quarantine("TRUST_ANCHOR_MISMATCH", first.deviceId, first.sequence, first.proof.eventDigest);
          }
          if (known.log_id !== first.logId || known.key_id !== first.keyId) {
            return this.quarantine("IDENTITY_MISMATCH", first.deviceId, first.sequence, first.proof.eventDigest);
          }
          const verification = verifyDeviceChain(events, checkpoint, known.public_key_pem);
          if (!verification.valid) {
            return this.quarantine(verification.code, first.deviceId, events[verification.eventCount]?.sequence ?? null, first.proof.eventDigest);
          }

          for (const event of events) {
            const existing = this.database
              .prepare(`
            SELECT device_id, device_sequence, source_event_id, source_chain_hash,
                   source_event_digest, source_event_json
            FROM ingestion_events WHERE device_id = ? AND device_sequence = ?
          `)
              .get(event.deviceId, event.sequence) as EventRow | undefined;
            if (
              existing &&
              (existing.source_event_id !== event.eventId ||
                existing.source_event_digest !== event.proof.eventDigest ||
                existing.source_chain_hash !== event.proof.chainHash)
            ) {
              return this.quarantine("FORK_DETECTED", event.deviceId, event.sequence, event.proof.eventDigest);
            }
          }

          const maxRow = this.database
            .prepare(`
          SELECT COALESCE(MAX(device_sequence), 0) AS value FROM ingestion_events WHERE device_id = ?
        `)
            .get(first.deviceId) as { value: number };
          let nextDeviceSequence = Number(maxRow.value) + 1;
          for (const event of events) {
            const exists = this.database
              .prepare(`
            SELECT 1 AS value FROM ingestion_events WHERE device_id = ? AND device_sequence = ?
          `)
              .get(event.deviceId, event.sequence) as { value: number } | undefined;
            if (exists) continue;
            if (event.sequence !== nextDeviceSequence) {
              return this.quarantine("SEQUENCE_GAP", event.deviceId, event.sequence, event.proof.eventDigest);
            }
            nextDeviceSequence += 1;
          }

          const previousCheckpoint = this.database
            .prepare(`
          SELECT checkpoint_digest, tree_size FROM device_checkpoints
          WHERE device_id = ? ORDER BY tree_size DESC, rowid DESC LIMIT 1
        `)
            .get(first.deviceId) as CheckpointRow | undefined;
          const checkpointExists = this.database
            .prepare(`
          SELECT 1 AS value FROM device_checkpoints WHERE checkpoint_digest = ?
        `)
            .get(checkpoint.digest) as { value: number } | undefined;
          if (
            !checkpointExists &&
            previousCheckpoint &&
            (checkpoint.treeSize < previousCheckpoint.tree_size || checkpoint.previousCheckpointHash !== previousCheckpoint.checkpoint_digest)
          )
            return this.quarantine("CHECKPOINT_MISMATCH", first.deviceId, checkpoint.treeSize, checkpoint.digest);
          if (!checkpointExists && !previousCheckpoint && Number(maxRow.value) > 0) {
            return this.quarantine("CHECKPOINT_MISMATCH", first.deviceId, checkpoint.treeSize, checkpoint.digest);
          }
          if (!previousCheckpoint && Number(maxRow.value) === 0) {
            const anchor = anchors.get(first.deviceId);
            if (!anchor) {
              return this.quarantine("TRUST_ANCHOR_MISMATCH", first.deviceId, checkpoint.treeSize, checkpoint.digest);
            }
            if (checkpoint.previousCheckpointHash === null) {
              if (anchor.bootstrapCheckpointDigest !== null) {
                return this.quarantine("CHECKPOINT_MISMATCH", first.deviceId, checkpoint.treeSize, checkpoint.digest);
              }
            } else if (anchor.bootstrapCheckpointDigest === null) {
              anchors.set(first.deviceId, { ...anchor, bootstrapCheckpointDigest: checkpoint.digest });
              this.#writeTrustedKeyAnchors(anchors);
              bootstrapAnchorPersisted = true;
            } else if (anchor.bootstrapCheckpointDigest !== checkpoint.digest) {
              return this.quarantine("CHECKPOINT_MISMATCH", first.deviceId, checkpoint.treeSize, checkpoint.digest);
            }
          }

          const inserted: GlobalIngestionRecord[] = [];
          for (const event of events) {
            const duplicate = this.database
              .prepare(`
          SELECT source_event_json FROM ingestion_events WHERE device_id = ? AND device_sequence = ?
        `)
              .get(event.deviceId, event.sequence) as { source_event_json: string | null } | undefined;
            if (duplicate) {
              if (duplicate.source_event_json === null) {
                this.database
                  .prepare(`
              UPDATE ingestion_events SET source_event_json = ?
              WHERE device_id = ? AND device_sequence = ? AND source_event_json IS NULL
            `)
                  .run(JSON.stringify(event), event.deviceId, event.sequence);
              }
              continue;
            }
            const globalRow = this.database
              .prepare(`
          SELECT COALESCE(MAX(global_sequence), 0) + 1 AS value FROM ingestion_events
        `)
              .get() as { value: number };
            const globalSequence = Number(globalRow.value);
            const head = this.database
              .prepare(`
          SELECT global_hash FROM ingestion_events ORDER BY global_sequence DESC LIMIT 1
        `)
              .get() as { global_hash: string } | undefined;
            const previousGlobalHash = head?.global_hash ?? globalGenesisHash();
            const ingestedAtEpochMs = this.#now();
            const decision: IngestionDecision = event.operation.type === "SAFE_TAG_ADD" ? "MERGED_SAFE_STATE" : "HUMAN_REVIEW_REQUIRED";
            const core: GlobalIngestionRecordCore = {
              version: SYNC_VERSION,
              ingestionEventId: uuidV7(ingestedAtEpochMs),
              ingestedAt: nowIso(ingestedAtEpochMs),
              ingestedAtEpochMs,
              globalSequence,
              previousGlobalHash,
              deviceId: event.deviceId,
              deviceSequence: event.sequence,
              sourceEventId: event.eventId,
              sourceEventDigest: event.proof.eventDigest,
              sourceChainHash: event.proof.chainHash,
              operation: structuredClone(event.operation),
              decision,
            };
            const record: GlobalIngestionRecord = {
              ...core,
              globalHash: globalRecordHash(previousGlobalHash, core as unknown as CanonicalValue),
            };
            this.database
              .prepare(`
          INSERT INTO ingestion_events (
            global_sequence, ingestion_event_id, ingested_at, device_id, device_sequence,
            source_event_id, source_event_digest, source_chain_hash, source_event_json, decision,
            previous_global_hash, global_hash, record_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
              .run(
                record.globalSequence,
                record.ingestionEventId,
                record.ingestedAtEpochMs,
                record.deviceId,
                record.deviceSequence,
                record.sourceEventId,
                record.sourceEventDigest,
                record.sourceChainHash,
                JSON.stringify(event),
                record.decision,
                record.previousGlobalHash,
                record.globalHash,
                JSON.stringify(record),
              );
            this.applyDecision(record);
            inserted.push(record);
          }
          if (!checkpointExists) {
            this.database
              .prepare(`
            INSERT INTO device_checkpoints (
              device_id, checkpoint_digest, tree_size, chain_head, previous_checkpoint_hash, checkpoint_json
            ) VALUES (?, ?, ?, ?, ?, ?)
          `)
              .run(
                checkpoint.deviceId,
                checkpoint.digest,
                checkpoint.treeSize,
                checkpoint.chainHead,
                checkpoint.previousCheckpointHash,
                JSON.stringify(checkpoint),
              );
          }
          return inserted.length === 0 ? { status: "DUPLICATE", records: [] } : { status: "INGESTED", records: inserted };
        });
      } catch (error) {
        if (bootstrapAnchorPersisted && this.#trustAnchorPath !== null) {
          try {
            this.#writeTrustedKeyAnchors(originalAnchors);
          } catch (restoreError) {
            throw new AggregateError([error, restoreError], "SQLite ingestion rolled back and the trusted bootstrap anchor could not be restored");
          }
        }
        this.#replaceTrustedKeyAnchors(originalAnchors);
        throw error;
      }
      this.#replaceTrustedKeyAnchors(anchors);
      return result;
    };
    return this.#trustAnchorPath === null
      ? ingestUnderSerializedBoundary()
      : withTrustedKeyAnchorLock(
          this.#trustAnchorPath,
          this.#trustAnchorLockTimeoutMs,
          this.#afterTrustAnchorLockDirectoryCreated,
          ingestUnderSerializedBoundary,
        );
  }

  ingestionRecords(): readonly GlobalIngestionRecord[] {
    return (this.database.prepare("SELECT record_json FROM ingestion_events ORDER BY global_sequence").all() as Array<{ record_json: string }>).map(
      (row) => JSON.parse(row.record_json) as GlobalIngestionRecord,
    );
  }

  quarantines(): readonly QuarantineRecord[] {
    return (this.database.prepare("SELECT record_json FROM quarantine ORDER BY occurred_at, rowid").all() as Array<{ record_json: string }>).map(
      (row) => JSON.parse(row.record_json) as QuarantineRecord,
    );
  }

  safeTags(setId: string): readonly string[] {
    return (this.database.prepare("SELECT tag FROM safe_tags WHERE set_id = ? ORDER BY tag").all(setId) as Array<{ tag: string }>).map((row) => row.tag);
  }

  dangerousReviews(): readonly DangerousReview[] {
    return (
      this.database.prepare("SELECT * FROM dangerous_reviews ORDER BY intent_id").all() as Array<{
        intent_id: string;
        effect_kind: DangerousReview["effectKind"];
        payload_digest: string;
        status: "HUMAN_REVIEW_REQUIRED";
        source_count: number;
        conflicting_payloads: number;
      }>
    ).map((row) => ({
      intentId: row.intent_id,
      effectKind: row.effect_kind,
      payloadDigest: row.payload_digest,
      status: row.status,
      sourceCount: Number(row.source_count),
      conflictingPayloads: Boolean(row.conflicting_payloads),
    }));
  }

  globalCount(): number {
    return Number((this.database.prepare("SELECT count(*) AS value FROM ingestion_events").get() as { value: number }).value);
  }

  externalEffectStarts(): 0 {
    return 0;
  }

  verifyGlobalChain(): {
    valid: boolean;
    count: number;
    lastHash: string;
    reason:
      | "VERIFIED"
      | "GLOBAL_CHAIN_MISMATCH"
      | "LEGACY_SOURCE_REBIND_REQUIRED"
      | "SIGNED_SOURCE_MISMATCH"
      | "SIGNED_DEVICE_CHAIN_MISMATCH"
      | "TRUST_ANCHOR_MISMATCH";
  } {
    this.#refreshTrustedKeyAnchors();
    let previousHash = globalGenesisHash();
    let expectedSequence = 1;
    const deviceSources = new Map<string, SignedDeviceEvent[]>();
    const devicePublicKeys = new Map<string, string>();
    for (const record of this.ingestionRecords()) {
      const { globalHash, ...core } = record;
      if (
        record.globalSequence !== expectedSequence ||
        record.previousGlobalHash !== previousHash ||
        globalRecordHash(previousHash, core as unknown as CanonicalValue) !== globalHash
      )
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "GLOBAL_CHAIN_MISMATCH" };
      const sourceRow = this.database
        .prepare(`
        SELECT global_sequence, ingestion_event_id, ingested_at, device_id, device_sequence,
               source_event_id, source_event_digest, source_chain_hash, source_event_json,
               decision, previous_global_hash, global_hash
        FROM ingestion_events WHERE global_sequence = ?
      `)
        .get(record.globalSequence) as IngestionAuditRow | undefined;
      if (
        !sourceRow ||
        sourceRow.global_sequence !== record.globalSequence ||
        sourceRow.ingestion_event_id !== record.ingestionEventId ||
        sourceRow.ingested_at !== record.ingestedAtEpochMs ||
        sourceRow.device_id !== record.deviceId ||
        sourceRow.device_sequence !== record.deviceSequence ||
        sourceRow.source_event_id !== record.sourceEventId ||
        sourceRow.source_event_digest !== record.sourceEventDigest ||
        sourceRow.source_chain_hash !== record.sourceChainHash ||
        sourceRow.decision !== record.decision ||
        sourceRow.previous_global_hash !== record.previousGlobalHash ||
        sourceRow.global_hash !== record.globalHash
      )
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_SOURCE_MISMATCH" };
      const known = this.database
        .prepare(`
        SELECT device_id, log_id, key_id, public_key_pem FROM known_device_keys WHERE device_id = ?
      `)
        .get(record.deviceId) as KnownKeyRow | undefined;
      if (!known || !this.#knownKeyMatchesAnchor(known)) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "TRUST_ANCHOR_MISMATCH" };
      }
      let sourceEvent: SignedDeviceEvent | null = null;
      if (sourceRow.source_event_json === null) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "LEGACY_SOURCE_REBIND_REQUIRED" };
      }
      try {
        sourceEvent = JSON.parse(sourceRow.source_event_json) as SignedDeviceEvent;
      } catch {
        sourceEvent = null;
      }
      if (
        sourceRow.source_event_digest !== record.sourceEventDigest ||
        sourceRow.source_chain_hash !== record.sourceChainHash ||
        !sourceEvent ||
        known.log_id !== sourceEvent.logId ||
        known.key_id !== sourceEvent.keyId ||
        !verifySignedDeviceEvent(sourceEvent, known.public_key_pem) ||
        sourceEvent.eventId !== record.sourceEventId ||
        sourceEvent.deviceId !== record.deviceId ||
        sourceEvent.sequence !== record.deviceSequence ||
        sourceEvent.proof.eventDigest !== record.sourceEventDigest ||
        sourceEvent.proof.chainHash !== record.sourceChainHash ||
        canonicalJson(sourceEvent.operation as unknown as CanonicalValue) !== canonicalJson(record.operation as unknown as CanonicalValue) ||
        record.decision !== (sourceEvent.operation.type === "SAFE_TAG_ADD" ? "MERGED_SAFE_STATE" : "HUMAN_REVIEW_REQUIRED")
      ) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_SOURCE_MISMATCH" };
      }
      const sources = deviceSources.get(record.deviceId) ?? [];
      sources.push(sourceEvent);
      deviceSources.set(record.deviceId, sources);
      devicePublicKeys.set(record.deviceId, known.public_key_pem);
      previousHash = globalHash;
      expectedSequence += 1;
    }
    for (const [deviceId, sourceEvents] of deviceSources) {
      sourceEvents.sort((left, right) => left.sequence - right.sequence);
      const checkpointRows = this.database
        .prepare(`
        SELECT device_id, checkpoint_digest, tree_size, chain_head,
               previous_checkpoint_hash, checkpoint_json
        FROM device_checkpoints
        WHERE device_id = ?
        ORDER BY rowid
      `)
        .all(deviceId) as unknown as CheckpointMembershipRow[];
      if (checkpointRows.length === 0) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
      }
      const checkpoints: SignedCheckpoint[] = [];
      for (const row of checkpointRows) {
        let checkpoint: SignedCheckpoint | null = null;
        try {
          checkpoint = JSON.parse(row.checkpoint_json) as SignedCheckpoint;
        } catch {
          checkpoint = null;
        }
        if (
          !checkpoint ||
          row.device_id !== checkpoint.deviceId ||
          row.checkpoint_digest !== checkpoint.digest ||
          row.tree_size !== checkpoint.treeSize ||
          row.chain_head !== checkpoint.chainHead ||
          row.previous_checkpoint_hash !== checkpoint.previousCheckpointHash ||
          !Number.isSafeInteger(checkpoint.treeSize) ||
          checkpoint.treeSize < 1 ||
          checkpoint.treeSize > sourceEvents.length ||
          !verifyDeviceChain(sourceEvents.slice(0, checkpoint.treeSize), checkpoint, devicePublicKeys.get(deviceId)!).valid
        ) {
          return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
        }
        checkpoints.push(checkpoint);
      }
      if (!checkpoints.some((checkpoint) => checkpoint.treeSize === sourceEvents.length)) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
      }
      const byDigest = new Map(checkpoints.map((checkpoint) => [checkpoint.digest, checkpoint]));
      const bootstrapCheckpointDigest = this.#trustedKeyAnchors.get(deviceId)?.bootstrapCheckpointDigest ?? null;
      if (bootstrapCheckpointDigest !== null && !byDigest.has(bootstrapCheckpointDigest)) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
      }
      const childByParent = new Map<string, SignedCheckpoint>();
      const roots: SignedCheckpoint[] = [];
      for (const checkpoint of checkpoints) {
        if (checkpoint.digest === bootstrapCheckpointDigest) {
          if (checkpoint.previousCheckpointHash === null) {
            return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
          }
          roots.push(checkpoint);
          continue;
        }
        if (checkpoint.previousCheckpointHash === null) {
          roots.push(checkpoint);
          continue;
        }
        const parent = byDigest.get(checkpoint.previousCheckpointHash);
        if (!parent) {
          return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
        }
        if (childByParent.has(parent.digest) || checkpoint.treeSize < parent.treeSize || checkpoint.createdAtEpochMs < parent.createdAtEpochMs) {
          return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
        }
        childByParent.set(parent.digest, checkpoint);
      }
      if (roots.length !== 1) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
      }
      let linkedCount = 0;
      let cursor: SignedCheckpoint | undefined = roots[0];
      while (cursor) {
        linkedCount += 1;
        cursor = childByParent.get(cursor.digest);
      }
      if (linkedCount !== checkpoints.length) {
        return { valid: false, count: expectedSequence - 1, lastHash: previousHash, reason: "SIGNED_DEVICE_CHAIN_MISMATCH" };
      }
    }
    return { valid: true, count: expectedSequence - 1, lastHash: previousHash, reason: "VERIFIED" };
  }

  private applyDecision(record: GlobalIngestionRecord): void {
    const operation = record.operation;
    if (operation.type === "SAFE_TAG_ADD") {
      this.database
        .prepare(`
        INSERT OR IGNORE INTO safe_tags (set_id, tag, first_source_event_digest) VALUES (?, ?, ?)
      `)
        .run(operation.setId, operation.tag, record.sourceEventDigest);
      return;
    }
    const existing = this.database.prepare("SELECT * FROM dangerous_reviews WHERE intent_id = ?").get(operation.intentId) as
      | {
          effect_kind: string;
          payload_digest: string;
          source_count: number;
          conflicting_payloads: number;
        }
      | undefined;
    if (!existing) {
      this.database
        .prepare(`
        INSERT INTO dangerous_reviews (
          intent_id, effect_kind, payload_digest, status, source_count, conflicting_payloads
        ) VALUES (?, ?, ?, 'HUMAN_REVIEW_REQUIRED', 1, 0)
      `)
        .run(operation.intentId, operation.effectKind, operation.payloadDigest);
    } else {
      const conflict = existing.effect_kind !== operation.effectKind || existing.payload_digest !== operation.payloadDigest;
      this.database
        .prepare(`
        UPDATE dangerous_reviews
        SET source_count = source_count + 1,
            conflicting_payloads = CASE WHEN conflicting_payloads = 1 OR ? THEN 1 ELSE 0 END
        WHERE intent_id = ?
      `)
        .run(conflict ? 1 : 0, operation.intentId);
    }
    this.database
      .prepare(`
      INSERT INTO dangerous_review_sources (
        intent_id, source_event_digest, device_id, device_sequence
      ) VALUES (?, ?, ?, ?)
    `)
      .run(operation.intentId, record.sourceEventDigest, record.deviceId, record.deviceSequence);
  }

  private quarantine(code: QuarantineCode, deviceId: string | null, deviceSequence: number | null, observedDigest: string): IngestResult {
    const occurredAtEpochMs = this.#now();
    const digest = /^[0-9a-f]{64}$/.test(observedDigest) ? observedDigest : sha256Hex(observedDigest);
    const record: QuarantineRecord = {
      version: SYNC_VERSION,
      quarantineId: uuidV7(occurredAtEpochMs),
      occurredAt: nowIso(occurredAtEpochMs),
      occurredAtEpochMs,
      code,
      deviceId,
      deviceSequence,
      observedDigest: digest,
      state: "REJECTED",
      externalEffectStarts: 0,
    };
    this.database
      .prepare(`
      INSERT INTO quarantine (
        quarantine_id, occurred_at, code, device_id, device_sequence, observed_digest, record_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .run(record.quarantineId, record.occurredAtEpochMs, record.code, record.deviceId, record.deviceSequence, record.observedDigest, JSON.stringify(record));
    return { status: "QUARANTINED", code, quarantine: record };
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}
