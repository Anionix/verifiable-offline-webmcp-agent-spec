<!-- information_uuid_v5=e8c9f0c4-aa3c-5c42-a4c1-bf2a5069decc event_uuid_v7=01a04896-44e5-74c0-be71-f7c6d18c5a5a state_transition=DRY_RUN -> VERIFIED occurred_at=2026-08-28T13:36:42.725Z -->

# Audit data

The event stream is synthetic and signed with ephemeral keys created during artifact generation. Only public keys are included. `tamper-report.json` shows that modifying event 2 changes that event and every subsequent chain hash, changes the Merkle root, and invalidates signatures.

`notification-demo-live-events.ndjson` is different: it is the captured SHA-256 hash chain from the user-approved 2026-08-28 local browser-notification run. It contains no secret key or account credential. `make validate` recomputes its hashes, checks UUIDv5/v7 identity and time binding, requires exactly one external-effect claim, and requires a recorded suppressed duplicate retry. The matching summary is [`metadata/notification-demo-live-verification.json`](../../metadata/notification-demo-live-verification.json).
