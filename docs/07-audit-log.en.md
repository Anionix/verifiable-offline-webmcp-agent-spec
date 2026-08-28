---
title: "Cryptographic Audit Log"
language: "en"
stable_uuid_v5: "002cd231-8315-518f-b981-9eccdd3058a7"
event_uuid_v7: "01a04291-b464-796f-9e16-6520cb7b5401"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Cryptographic Audit Log

Current state is a projection of the event stream. Events use canonical JSON, a SHA-256 hash chain, Ed25519 signatures, and Merkle checkpoints. JCS, SHA-256, Ed25519, and certificate-transparency-style Merkle proofs provide the primary technical basis. [SRC-RFC8785](source-map.md#src-rfc8785) [SRC-FIPS180-4](source-map.md#src-fips180-4) [SRC-RFC8032](source-map.md#src-rfc8032) [SRC-RFC9162](source-map.md#src-rfc9162)

Cryptography protects recorded provenance, not physical truth; independent evidence remains necessary.
