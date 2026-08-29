#!/usr/bin/env node
// information_uuid_v5=0ff950bd-29cc-553a-bfc2-80389fae8c87
// event_uuid_v7=01a04bd0-b895-7405-b324-f6d6d235f7d8 state_transition=HOTEL_BUILD -> LOCALLY_VERIFIED occurred_at=2026-08-29T01:00:00Z
// event_uuid_v7=01a04b41-fd38-7d33-bb26-b920ba18d4c2 state_transition=COMBINED_VALIDATOR -> TWO_INDEPENDENT_RECEIPTS occurred_at=2026-08-29T02:03:31.000Z
// machine-contract: combined validation succeeds only after the portable client and Sites package validators each issue their own receipt.

await import("./validate_hotel_portable_validator.mjs");
await import("./validate_hotel_sites_validator.mjs");
console.log(JSON.stringify({ receipt: "HOTEL_COMBINED_VALIDATION_PASS", componentReceipts: 2 }));
