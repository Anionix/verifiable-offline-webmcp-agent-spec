#!/usr/bin/env node
// information_uuid_v5=ac397ed8-9f18-59a5-9474-5232d8c63acd
// event_uuid_v7=01a04bd0-b895-7a78-afc7-e3b57f0ecb10 state_transition=NOTIFICATION_VALIDATOR -> HOTEL_SHARED_VALIDATOR occurred_at=2026-08-29T01:00:00Z
// event_uuid_v7=01a04b41-fd38-72cf-84ef-f586dd4ec29a state_transition=COMBINED_VALIDATOR -> PORTABLE_ONLY_VALIDATOR occurred_at=2026-08-29T02:03:31.000Z
// machine-contract: Vercel validation proves only the portable dist/client artifact and host configuration; Sites server packaging is a separate receipt.

await import("./validate_hotel_portable_validator.mjs");
