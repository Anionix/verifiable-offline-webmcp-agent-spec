import { randomBytes } from "node:crypto";
import { v5 as standardUuidV5 } from "uuid";

const CANONICAL_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function canonicalUuidBytes(value: string): Buffer {
  if (!CANONICAL_UUID_PATTERN.test(value)) throw new TypeError("UUID must use canonical lowercase text");
  return Buffer.from(value.replaceAll("-", ""), "hex");
}

export function isUuidVersion(value: string, version: 5 | 7): boolean {
  try {
    const bytes = canonicalUuidBytes(value);
    return (bytes[6]! >> 4) === version && (bytes[8]! & 0xc0) === 0x80;
  } catch {
    return false;
  }
}

export function uuidV5(namespace: string, name: string): string {
  // information_uuid_v5=51e1df88-0bd8-5bce-802c-3ee0370f3b5a
  // event_uuid_v7=01a04cd8-5ae9-7fbd-a286-40502e8f2aa4 state_transition=INLINE_SHA1 -> REVIEWED_STANDARD_UUIDV5 occurred_at=2026-08-29T09:27:22.601Z
  // machine-contract: UNTRUSTED_NAMESPACE -> CANONICAL_NAMESPACE -> RFC_9562_UUIDV5.
  // UUIDv5 is a deterministic identifier, never a password, signature, or integrity proof.
  canonicalUuidBytes(namespace);
  return standardUuidV5(name, namespace);
}

export function uuidV7(epochMs = Date.now()): string {
  if (!Number.isSafeInteger(epochMs) || epochMs < 0 || epochMs >= 2 ** 48) {
    throw new RangeError("epochMs must fit 48 unsigned bits");
  }
  const b = randomBytes(16);
  let t = BigInt(epochMs);
  for (let i = 5; i >= 0; i--) { b[i] = Number(t & 0xffn); t >>= 8n; }
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  return format(b);
}

export function uuidV7EpochMs(value: string): number {
  if (!isUuidVersion(value, 7)) throw new TypeError("not canonical UUIDv7");
  const b = canonicalUuidBytes(value);
  let t = 0n;
  for (let i = 0; i < 6; i++) t = (t << 8n) | BigInt(b[i]!);
  return Number(t);
}

function format(b: Uint8Array): string {
  const h = Buffer.from(b).toString("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
