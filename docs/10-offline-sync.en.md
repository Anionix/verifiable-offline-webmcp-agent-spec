---
title: "Offline Queue and Synchronization"
language: "en"
stable_uuid_v5: "63ea27c6-9221-5abb-9ba0-fda2e24baf2c"
event_uuid_v7: "01a04291-b46a-72b3-8a00-7d3a2097e5b6"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Offline Queue and Synchronization

The queue stores unexecuted intent, so `QUEUED ⇒ externalEffectStarted = false`. Replay revalidates online state, expiry, authorization, permission, version, consent, and preconditions. CRDT merge is restricted to commutative/idempotent data; payments, sends, reservations, and destructive effects become explicit conflicts. [SRC-CRDT-2011](source-map.md#src-crdt-2011) [SRC-LITTLE-1961](source-map.md#src-little-1961)
