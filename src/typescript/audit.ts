import { createHash, verify } from "node:crypto";
import { canonicalJson, type CanonicalValue } from "./canonical.ts";

export function sha256Hex(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function eventDigest(core: CanonicalValue): string {
  return sha256Hex(Buffer.concat([Buffer.from([0]), Buffer.from(canonicalJson(core), "utf8")]));
}

export function chainHash(previousHex: string, digestHex: string, sequence: number): string {
  const seq = Buffer.alloc(8); seq.writeBigUInt64BE(BigInt(sequence));
  return sha256Hex(Buffer.concat([
    Buffer.from([1]), Buffer.from(previousHex, "hex"), Buffer.from(digestHex, "hex"), seq,
  ]));
}

export function verifyEd25519(publicKeyPem: string, message: Uint8Array, signatureB64: string): boolean {
  return verify(null, message, publicKeyPem, Buffer.from(signatureB64, "base64"));
}
