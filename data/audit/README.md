<!-- information_uuid_v5=e8c9f0c4-aa3c-5c42-a4c1-bf2a5069decc event_uuid_v7=01a04896-44e5-74c0-be71-f7c6d18c5a5a state_transition=DRY_RUN -> VERIFIED occurred_at=2026-08-28T13:36:42.725Z -->

# Audit data

The event stream is synthetic and signed with ephemeral keys created during artifact generation. Only public keys are included. `tamper-report.json` shows that modifying event 2 changes that event and every subsequent chain hash, changes the Merkle root, and invalidates signatures.

`notification-demo-live-events.ndjson` is different: it is the captured SHA-256 hash chain from the user-approved 2026-08-28 local browser-notification run. It contains no secret key or account credential. `make validate` recomputes its hashes, checks UUIDv5/v7 identity and time binding, requires exactly one external-effect claim, and requires a recorded suppressed duplicate retry. The matching summary is [`metadata/notification-demo-live-verification.json`](../../metadata/notification-demo-live-verification.json).

<!-- information_uuid_v5=70c833c5-d5b6-5474-815f-3b990246c661 event_uuid_v7=01a04927-4702-79ac-a6a0-967578c1a612 state_transition=OFFLINE_DIVERGENCE -> PUBLIC_EVIDENCE occurred_at=2026-08-28T16:15:06.050Z -->

`offline-sync-device-events.ndjson` contains two logical devices' signed event chains. `offline-sync-ingestion.ndjson` preserves the device sequence and adds a cross-device global sequence. `offline-sync-quarantine.ndjson` records four rejected probes: invalid signature, sequence gap, signed fork, and checkpoint mismatch. Only the two public keys are stored; the evidence generator discards its process-local private keys. The matching summary is [`metadata/offline-sync-verification.json`](../../metadata/offline-sync-verification.json).

<!-- information_uuid_v5=a9fe8944-cb3f-5eb4-8f9d-0c0b82072431 event_uuid_v7=01a04948-c160-7439-91c2-c108ec48b3c1 state_transition=SCRIPTED_FAILURES -> CANDIDATE_ONLY_EVIDENCE occurred_at=2026-08-28T16:51:40Z -->

`online-planner-events.ndjson` is a deterministic hash chain from 13 local scripted planner scenarios. Records contain UUIDv7 event and run identifiers, UUIDv5 task identifiers, field names, digests, bounded counters, and stop reasons. They do not contain private context values or model credentials. Exactly one event records an untrusted candidate; every event records zero automatic retries, zero authorization creation, and zero external-effect starts. The matching summary is [`metadata/online-planner-verification.json`](../../metadata/online-planner-verification.json).
