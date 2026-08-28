import { createHash, randomBytes } from "node:crypto";

export function uuidV5(namespace: string, name: string): string {
  const ns = Buffer.from(namespace.replaceAll("-", ""), "hex");
  if (ns.length !== 16) throw new TypeError("namespace must be UUID");
  const digest = createHash("sha1").update(ns).update(Buffer.from(name, "utf8")).digest();
  const bytes = digest.subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  return format(bytes);
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
  const b = Buffer.from(value.replaceAll("-", ""), "hex");
  if (b.length !== 16 || (b[6]! >> 4) !== 7) throw new TypeError("not UUIDv7");
  let t = 0n;
  for (let i = 0; i < 6; i++) t = (t << 8n) | BigInt(b[i]!);
  return Number(t);
}

function format(b: Uint8Array): string {
  const h = Buffer.from(b).toString("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
