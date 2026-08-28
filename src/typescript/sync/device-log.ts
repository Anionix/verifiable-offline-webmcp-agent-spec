// information_uuid_v5=4c46a65c-66c0-5243-a754-8616768cdb94
// event_uuid_v7=01a0491b-3d80-7f35-aefd-389ffa4d29bc
// machine-contract: OFFLINE_APPEND -> SIGNED_CHECKPOINT -> VERIFIED; invalid time, identity, sequence, hash, or signature fails closed.
import { createPublicKey, generateKeyPairSync, type KeyObject } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";
import { isUuidVersion, uuidV5, uuidV7, uuidV7EpochMs } from "../uuid.ts";
import {
  canonicalDigest,
  chainedDigest,
  checkpointSignatureMessage,
  deviceGenesisHash,
  eventSignatureMessage,
  merkleRoot,
  signBase64,
  verifyBase64,
} from "./crypto.ts";
import {
  SYNC_UUID_NAMESPACE,
  SYNC_VERSION,
  type DeviceChainVerification,
  type DeviceIdentity,
  type DeviceKeyMaterial,
  type SignedCheckpoint,
  type SignedCheckpointCore,
  type SignedDeviceEvent,
  type SignedDeviceEventCore,
  type SyncOperation,
} from "./types.ts";

export function createDeviceIdentity(canonicalName: string): DeviceIdentity {
  const normalized = canonicalName.normalize("NFC").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(normalized)) throw new TypeError("device name must be a short lowercase slug");
  const deviceId = uuidV5(SYNC_UUID_NAMESPACE, `sync-device/${normalized}`);
  return Object.freeze({
    deviceId,
    logId: uuidV5(SYNC_UUID_NAMESPACE, `sync-log/${deviceId}`),
    keyId: uuidV5(SYNC_UUID_NAMESPACE, `sync-key/${deviceId}/ed25519-v1`),
  });
}

export function createDeviceKeyMaterial(): DeviceKeyMaterial {
  return generateKeyPairSync("ed25519");
}

function assertHex(value: string, name: string): void {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new TypeError(`${name} must be a lowercase SHA-256 digest`);
}

function assertOperation(operation: SyncOperation): void {
  if (operation.type === "SAFE_TAG_ADD") {
    if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(operation.setId)) throw new TypeError("setId must be a short slug");
    const tag = operation.tag.normalize("NFC").trim();
    if (!tag || tag.length > 120 || tag !== operation.tag) throw new TypeError("tag must be normalized, trimmed, and at most 120 characters");
    return;
  }
  if (!isUuidVersion(operation.intentId, 5)) throw new TypeError("dangerous intentId must be UUIDv5");
  assertHex(operation.payloadDigest, "payloadDigest");
}

function eventCore(event: SignedDeviceEvent): SignedDeviceEventCore {
  const { proof: _proof, ...core } = event;
  return core;
}

function checkpointCore(checkpoint: SignedCheckpoint): SignedCheckpointCore {
  const { digest: _digest, signature: _signature, ...core } = checkpoint;
  return core;
}

function failure(code: Exclude<DeviceChainVerification["code"], "VERIFIED">, eventCount: number, message: string): DeviceChainVerification {
  return { valid: false, code, eventCount, message };
}

export class SignedDeviceLog {
  readonly identity: Readonly<DeviceIdentity>;
  readonly publicKey: KeyObject;
  readonly #privateKey: KeyObject;
  readonly #now: () => number;
  readonly #events: SignedDeviceEvent[] = [];
  #previousCheckpointHash: string | null = null;

  constructor(identity: DeviceIdentity, options: { keys?: DeviceKeyMaterial; now?: () => number } = {}) {
    if (![identity.deviceId, identity.logId, identity.keyId].every(value => isUuidVersion(value, 5))) {
      throw new TypeError("device identity fields must be UUIDv5");
    }
    const keys = options.keys ?? createDeviceKeyMaterial();
    this.identity = Object.freeze({ ...identity });
    this.#privateKey = keys.privateKey;
    this.publicKey = keys.publicKey ?? createPublicKey(keys.privateKey);
    this.#now = options.now ?? Date.now;
  }

  append(operation: SyncOperation): SignedDeviceEvent {
    assertOperation(operation);
    const sequence = this.#events.length + 1;
    const occurredAtEpochMs = this.#now();
    const core: SignedDeviceEventCore = {
      version: SYNC_VERSION,
      eventId: uuidV7(occurredAtEpochMs),
      occurredAt: new Date(occurredAtEpochMs).toISOString(),
      occurredAtEpochMs,
      ...this.identity,
      sequence,
      previousChainHash: sequence === 1
        ? deviceGenesisHash(this.identity.logId, this.identity.deviceId)
        : this.#events.at(-1)!.proof.chainHash,
      operation: structuredClone(operation),
    };
    const digest = canonicalDigest(core as unknown as CanonicalValue);
    const chainHash = chainedDigest(core.previousChainHash, digest, sequence);
    const event: SignedDeviceEvent = {
      ...core,
      proof: {
        algorithm: "Ed25519",
        keyId: this.identity.keyId,
        eventDigest: digest,
        chainHash,
        signatureBase64: signBase64(
          this.#privateKey,
          eventSignatureMessage(this.identity.logId, this.identity.deviceId, sequence, chainHash),
        ),
      },
    };
    this.#events.push(event);
    return structuredClone(event);
  }

  checkpoint(): SignedCheckpoint {
    if (this.#events.length === 0) throw new Error("cannot checkpoint an empty device log");
    const createdAtEpochMs = this.#now();
    const core: SignedCheckpointCore = {
      version: SYNC_VERSION,
      checkpointId: uuidV7(createdAtEpochMs),
      createdAt: new Date(createdAtEpochMs).toISOString(),
      createdAtEpochMs,
      ...this.identity,
      treeSize: this.#events.length,
      merkleRoot: merkleRoot(this.#events.map(event => event.proof.eventDigest)),
      chainHead: this.#events.at(-1)!.proof.chainHash,
      previousCheckpointHash: this.#previousCheckpointHash,
    };
    const digest = canonicalDigest(core as unknown as CanonicalValue);
    const checkpoint: SignedCheckpoint = {
      ...core,
      digest,
      signature: {
        algorithm: "Ed25519",
        keyId: this.identity.keyId,
        signatureBase64: signBase64(this.#privateKey, checkpointSignatureMessage(digest)),
      },
    };
    this.#previousCheckpointHash = digest;
    return structuredClone(checkpoint);
  }

  events(): readonly SignedDeviceEvent[] {
    return structuredClone(this.#events);
  }

  publicKeyPem(): string {
    return this.publicKey.export({ type: "spki", format: "pem" }).toString();
  }
}

export function verifyDeviceChain(
  events: readonly SignedDeviceEvent[],
  checkpoint: SignedCheckpoint,
  publicKey: KeyObject | string,
): DeviceChainVerification {
  if (events.length === 0) return failure("EMPTY_CHAIN", 0, "device chain is empty");
  const first = events[0]!;
  let previousHash = deviceGenesisHash(first.logId, first.deviceId);
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (
      event.version !== SYNC_VERSION
      || event.deviceId !== first.deviceId
      || event.logId !== first.logId
      || event.keyId !== first.keyId
      || event.proof.keyId !== first.keyId
    ) return failure("IDENTITY_MISMATCH", index, `event ${index + 1} identity mismatch`);
    if (
      !isUuidVersion(event.deviceId, 5)
      || !isUuidVersion(event.logId, 5)
      || !isUuidVersion(event.keyId, 5)
      || !isUuidVersion(event.eventId, 7)
    ) return failure("INVALID_UUID", index, `event ${index + 1} UUID version mismatch`);
    try {
      if (
        uuidV7EpochMs(event.eventId) !== event.occurredAtEpochMs
        || Date.parse(event.occurredAt) !== event.occurredAtEpochMs
      ) return failure("EVENT_TIME_MISMATCH", index, `event ${index + 1} time mismatch`);
    } catch {
      return failure("EVENT_TIME_MISMATCH", index, `event ${index + 1} time is invalid`);
    }
    if (event.sequence !== index + 1) return failure("SEQUENCE_GAP", index, `expected sequence ${index + 1}`);
    if (event.previousChainHash !== previousHash) return failure("CHAIN_MISMATCH", index, `event ${index + 1} previous hash mismatch`);
    let digest: string;
    try {
      assertOperation(event.operation);
      digest = canonicalDigest(eventCore(event) as unknown as CanonicalValue);
    } catch (error) {
      return failure("DIGEST_MISMATCH", index, error instanceof Error ? error.message : "event is not canonical");
    }
    if (event.proof.eventDigest !== digest) return failure("DIGEST_MISMATCH", index, `event ${index + 1} digest mismatch`);
    const chainHash = chainedDigest(previousHash, digest, event.sequence);
    if (event.proof.chainHash !== chainHash) return failure("CHAIN_MISMATCH", index, `event ${index + 1} chain hash mismatch`);
    if (!verifyBase64(publicKey, eventSignatureMessage(event.logId, event.deviceId, event.sequence, chainHash), event.proof.signatureBase64)) {
      return failure("INVALID_SIGNATURE", index, `event ${index + 1} signature mismatch`);
    }
    previousHash = chainHash;
  }

  if (
    checkpoint.version !== SYNC_VERSION
    || checkpoint.deviceId !== first.deviceId
    || checkpoint.logId !== first.logId
    || checkpoint.keyId !== first.keyId
    || checkpoint.signature.keyId !== first.keyId
    || checkpoint.signature.algorithm !== "Ed25519"
    || checkpoint.treeSize !== events.length
    || checkpoint.chainHead !== previousHash
    || checkpoint.merkleRoot !== merkleRoot(events.map(event => event.proof.eventDigest))
    || !isUuidVersion(checkpoint.checkpointId, 7)
  ) return failure("CHECKPOINT_MISMATCH", events.length, "checkpoint content does not match the device chain");
  try {
    if (
      uuidV7EpochMs(checkpoint.checkpointId) !== checkpoint.createdAtEpochMs
      || Date.parse(checkpoint.createdAt) !== checkpoint.createdAtEpochMs
    ) return failure("CHECKPOINT_MISMATCH", events.length, "checkpoint time mismatch");
  } catch {
    return failure("CHECKPOINT_MISMATCH", events.length, "checkpoint time is invalid");
  }
  const digest = canonicalDigest(checkpointCore(checkpoint) as unknown as CanonicalValue);
  if (
    checkpoint.digest !== digest
    || !verifyBase64(publicKey, checkpointSignatureMessage(digest), checkpoint.signature.signatureBase64)
  ) return failure("CHECKPOINT_MISMATCH", events.length, "checkpoint digest or signature mismatch");
  return {
    valid: true,
    code: "VERIFIED",
    eventCount: events.length,
    chainHead: previousHash,
    merkleRoot: checkpoint.merkleRoot,
  };
}

export function canonicalEventJson(event: SignedDeviceEvent): string {
  return canonicalJson(event as unknown as CanonicalValue);
}
