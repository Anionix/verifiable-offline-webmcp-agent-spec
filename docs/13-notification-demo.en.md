---
title: "Duplicate-safe Mac notification demo"
language: "en"
stable_uuid_v5: "0326d30e-9d18-5222-9d7e-00c2f4bb02b9"
event_uuid_v7: "01a04867-0d7b-72eb-bc39-587a456ea391"
updated_event_uuid_v7: "01a048c2-e323-70ba-b5f4-31defb329ce0"
generated_at: "2026-08-28T12:23:50Z"
updated_at: "2026-08-28T14:25:32.776Z"
version: "0.2.0"
status: "live-verified"
---

# Duplicate-safe Mac notification demo

## Purpose

This local reference implementation prevents a second visible notification for the same logical operation across retries, response loss, and process restarts. In addition to simulated fault coverage, one real notification was displayed on this Mac after immediate user approval, and the external-effect start count remained one after retrying the same operation.

日本語要約: 同じ論理操作の通知を、通信切断や再試行があっても二度表示しない参照実装です。

## Boundary and machine contract

`NotificationEngine` owns normalization, UUIDv5 intent identity, approval checks, and transitions. `NotificationStore` owns three SQLite tables and the unique logical-operation constraint. `AuditLog` records UUIDv7 events in a SHA-256 hash-chained JSON Lines file. An adapter exposes only `preview`, `execute`, and `reconcile`.

```text
DISCOVERED -> PROPOSED -> DRY_RUN -> USER_APPROVED -> EXECUTING -> VERIFIED
                    |             |                 |-> ABORTED
                    |             |-> REJECTED

NOT_STARTED -> AMBIGUOUS -> RECONCILING -> CONFIRMED_PRESENT
                                      |-> CONFIRMED_ABSENT
```

Machine contract: `AMBIGUOUS` permits reconciliation only. A new approval and retry are allowed only after readback establishes `CONFIRMED_ABSENT`.

## Run locally

```bash
uv sync --frozen
cd src/typescript && npm ci && cd ../..
make validate
make benchmark-notification
make demo
```

Open `http://127.0.0.1:4173`. Preview is side-effect free. The browser asks for notification permission only from the explicit approval click. The notification tag equals the UUIDv5 intent ID, and `getNotifications()` provides independent readback before the intent becomes `VERIFIED`.

Automated coverage includes success, failure before effect, timeout after effect, ambiguous-state retry rejection, reconciliation, restart persistence, approval expiry, distinct logical operations with identical content, and 100 healthy simulated runs.

On 2026-08-28 this Mac measured a `8.99 ms` p95 across 100 simulated samples, below the `2,000 ms` bound. The environment and every sample are stored in [`metadata/notification-demo-latency.json`](../metadata/notification-demo-latency.json) and [`data/timeseries/notification-demo-latency.ndjson`](../data/timeseries/notification-demo-latency.ndjson). This is not a browser-notification latency measurement.

## Duplicate-prevention visualization

The `0.3.0` candidate page shows the initial request and same-operation retry converging on one `Intent ID` ledger, with only the second effect stopped. The count is read from the SQLite effect ledger rather than hard-coded; a value above one is rendered as a safety violation. The screen contract and the desktop and 390-pixel-wide checks are recorded in [`14-notification-visualization.ja.md`](14-notification-visualization.ja.md). This visual check used the dry run only and did not display another real notification.

## Live Mac evidence

On 2026-08-28, Google Chrome `152.0.7977.64` displayed one notification tagged with UUIDv5 intent ID `03c9c953-71ea-5405-b1eb-3c0536e78ec1`. Service Worker readback returned one active notification, SQLite contained one external-effect claim, and retrying the same logical operation returned `ALREADY_VERIFIED` without a second claim. The final state was `VERIFIED / CONFIRMED_PRESENT`, and all six public JSON Lines audit entries form a valid hash chain.

The public evidence is [`metadata/notification-demo-live-verification.json`](../metadata/notification-demo-live-verification.json) and [`data/audit/notification-demo-live-events.ndjson`](../data/audit/notification-demo-live-events.ndjson). External-service cost was zero. This is local observation plus Service Worker readback, not remote attestation.

Codex's in-app browser exposed `document.modelContext` and registered `notify_once` during the visual check. Native WebMCP conformance across target browsers, including execution, permission, and contamination controls, remains `INCONCLUSIVE`. Node.js 24 documents `node:sqlite` at release-candidate stability. Primary sources: [WHATWG Notifications API](https://notifications.spec.whatwg.org/), [Node.js SQLite](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html), and the [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/).
