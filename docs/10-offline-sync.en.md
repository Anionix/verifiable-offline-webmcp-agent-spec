---
title: "Offline Queue and Synchronization"
language: "en"
stable_uuid_v5: "63ea27c6-9221-5abb-9ba0-fda2e24baf2c"
event_uuid_v7: "01a04291-b46a-72b3-8a00-7d3a2097e5b6"
updated_event_uuid_v7: "01a04927-4661-7ee3-8a17-5a90fc7400c0"
generated_at: "2026-08-27T09:34:00Z"
updated_at: "2026-08-28T16:15:05.985Z"
version: "0.4.0-candidate"
status: "reference-implementation"
---

# Offline Queue and Synchronization

The queue stores unexecuted intent, so `QUEUED ⇒ externalEffectStarted = false`. Replay revalidates online state, expiry, authorization, permission, version, consent, and preconditions. CRDT merge is restricted to commutative/idempotent data; payments, sends, reservations, and destructive effects become explicit conflicts. [SRC-CRDT-2011](source-map.md#src-crdt-2011) [SRC-LITTLE-1961](source-map.md#src-little-1961)

The `0.4.0` local reference now implements per-device Ed25519 chains, signed Merkle checkpoints, preserved device sequences, a global ingestion sequence, fork detection, an add-only tag set, and `HUMAN_REVIEW_REQUIRED` quarantine for external effects. The two-device walkthrough and explicit unmeasured boundaries are documented in [the Japanese reference guide](17-offline-sync-reference.ja.md).
