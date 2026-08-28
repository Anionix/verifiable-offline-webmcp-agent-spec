#!/usr/bin/env node
// information_uuid_v5=206722a5-4b79-58c3-b10e-c01639d22d4e
// event_uuid_v7=01a04a5f-5112-74f4-9183-f16e97883007
// event_uuid_v7=01a04a69-2b09-76ce-9f0d-e4f3c4c08549 state_transition=RESOURCE_REVIEWED -> EVALUATION_ASSET_ALLOWLISTED occurred_at=2026-08-28T22:06:43Z
// event_uuid_v7=01a04a96-683f-7c44-a5bb-76f99b2d978d state_transition=VERCEL_ONLY_ENTRYPOINT -> PORTABLE_BUILD_WRAPPER occurred_at=2026-08-28T22:56:06Z
// machine-contract: this compatibility entrypoint delegates to the single portable allowlist build and must not add host-only files.

await import("./build_web_site.mjs");
