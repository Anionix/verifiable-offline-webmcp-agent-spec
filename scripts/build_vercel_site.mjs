#!/usr/bin/env node
// information_uuid_v5=206722a5-4b79-58c3-b10e-c01639d22d4e
// event_uuid_v7=01a04a5f-5112-74f4-9183-f16e97883007
// event_uuid_v7=01a04a69-2b09-76ce-9f0d-e4f3c4c08549 state_transition=RESOURCE_REVIEWED -> EVALUATION_ASSET_ALLOWLISTED occurred_at=2026-08-28T22:06:43Z
// event_uuid_v7=01a04bd0-b895-7d83-9ad9-373106f9d56c state_transition=VERCEL_ONLY_ENTRYPOINT -> SHARED_CLIENT_BUILD occurred_at=2026-08-29T01:00:00Z
// machine-contract: this compatibility entrypoint delegates to the shared Vite build; Vercel publishes only dist/client.

await import("./build_web_site.mjs");
