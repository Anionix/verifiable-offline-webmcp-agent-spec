// information_uuid_v5=e7bef104-c2b7-5d9f-8499-fadf05943470
// event_uuid_v7=01a0491b-3d45-7577-a35a-1dd32f1ebfee
// machine-contract: canonical bytes -> digest -> chain hash -> Ed25519 signature; any mismatch transitions VERIFIED_INPUT -> REJECTED.
import { createHash, sign, verify, type KeyObject } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "../canonical.ts";

const EVENT_DOMAIN = Buffer.from("OFFLINE-SYNC-EVENT-v0.4\0", "utf8");
const CHECKPOINT_DOMAIN = Buffer.from("OFFLINE-SYNC-CHECKPOINT-v0.4\0", "utf8");
const GENESIS_DOMAIN = Buffer.from("OFFLINE-SYNC-GENESIS-v0.4\0", "utf8");
const GLOBAL_GENESIS_DOMAIN = Buffer.from("OFFLINE-SYNC-GLOBAL-v0.4\0", "utf8");

export function sha256Hex(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function uuidBytes(value: string): Buffer {
  const bytes = Buffer.from(value.replaceAll("-", ""), "hex");
  if (bytes.length !== 16) throw new TypeError("UUID must contain exactly 16 bytes");
  return bytes;
}

export function sequenceBytes(value: number): Buffer {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError("sequence must be a positive safe integer");
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(value));
  return bytes;
}

export function canonicalDigest(value: CanonicalValue): string {
  return sha256Hex(Buffer.concat([Buffer.from([0]), Buffer.from(canonicalJson(value), "utf8")]));
}

export function deviceGenesisHash(logId: string, deviceId: string): string {
  return sha256Hex(Buffer.concat([GENESIS_DOMAIN, uuidBytes(logId), uuidBytes(deviceId)]));
}

export function chainedDigest(previousHash: string, digest: string, sequence: number): string {
  return sha256Hex(Buffer.concat([
    Buffer.from([1]),
    Buffer.from(previousHash, "hex"),
    Buffer.from(digest, "hex"),
    sequenceBytes(sequence),
  ]));
}

export function eventSignatureMessage(logId: string, deviceId: string, sequence: number, chainHash: string): Buffer {
  return Buffer.concat([
    EVENT_DOMAIN,
    uuidBytes(logId),
    uuidBytes(deviceId),
    sequenceBytes(sequence),
    Buffer.from(chainHash, "hex"),
  ]);
}

export function checkpointSignatureMessage(digest: string): Buffer {
  return Buffer.concat([CHECKPOINT_DOMAIN, Buffer.from(digest, "hex")]);
}

export function signBase64(privateKey: KeyObject, message: Uint8Array): string {
  return sign(null, message, privateKey).toString("base64");
}

export function verifyBase64(publicKey: KeyObject | string, message: Uint8Array, signatureBase64: string): boolean {
  try {
    return verify(null, message, publicKey, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}

function merkleLeaf(digest: string): Buffer {
  return createHash("sha256").update(Buffer.concat([Buffer.from([0]), Buffer.from(digest, "hex")])).digest();
}

function merkleNode(left: Buffer, right: Buffer): Buffer {
  return createHash("sha256").update(Buffer.concat([Buffer.from([1]), left, right])).digest();
}

function largestPowerOfTwoBelow(value: number): number {
  let result = 1;
  while (result * 2 < value) result *= 2;
  return result;
}

function merkleTree(digests: readonly string[]): Buffer {
  if (digests.length === 0) return createHash("sha256").update(Buffer.alloc(0)).digest();
  if (digests.length === 1) return merkleLeaf(digests[0]!);
  const split = largestPowerOfTwoBelow(digests.length);
  return merkleNode(merkleTree(digests.slice(0, split)), merkleTree(digests.slice(split)));
}

export function merkleRoot(digests: readonly string[]): string {
  return merkleTree(digests).toString("hex");
}

export function globalGenesisHash(): string {
  return sha256Hex(GLOBAL_GENESIS_DOMAIN);
}

export function globalRecordHash(previousGlobalHash: string, core: CanonicalValue): string {
  return sha256Hex(Buffer.concat([
    Buffer.from([2]),
    Buffer.from(previousGlobalHash, "hex"),
    Buffer.from(canonicalJson(core), "utf8"),
  ]));
}
