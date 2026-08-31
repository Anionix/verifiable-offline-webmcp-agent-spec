---
title: "Duplicate-safe Mac notification demo"
language: "en"
stable_uuid_v5: "0326d30e-9d18-5222-9d7e-00c2f4bb02b9"
event_uuid_v7: "01a04867-0d7b-72eb-bc39-587a456ea391"
updated_event_uuid_v7: "01a048c2-e323-70ba-b5f4-31defb329ce0"
replay_verification_event_uuid_v7: "01a0497e-f947-7442-b95c-2eed7476e477"
replay_browser_event_uuid_v7: "01a04987-5d7c-7ebe-9208-c468f5c24ebf"
effect_accounting_event_uuid_v7: "01a0498b-5662-7094-9bef-88e9b2f13a10"
effect_start_semantics_event_uuid_v7: "01a04993-3867-7e11-b120-01b3bab8ec62"
approval_recovery_event_uuid_v7: "01a04c92-0d3a-7302-a9ae-07a565dd08db"
generated_at: "2026-08-28T12:23:50Z"
updated_at: "2026-08-28T18:13:00.135Z"
version: "0.2.0"
status: "live-verified"
---

# Duplicate-safe Mac notification demo

## Purpose

This local reference implementation prevents a second visible notification for the same logical operation across retries, response loss, and process restarts. In addition to simulated fault coverage, one real notification was displayed on this Mac after immediate user approval, and the external-effect start count remained one after retrying the same operation.

日本語要約: 同じ論理操作の通知を、通信切断や再試行があっても二度表示しない参照実装です。

## Boundary and machine contract

`NotificationEngine` owns normalization, UUIDv5 intent identity, approval checks, and transitions. `NotificationStore` owns three SQLite tables and the unique logical-operation constraint. `AuditLog` records UUIDv7 events in a SHA-256 hash-chained JSON Lines file. An adapter exposes only `preview`, `execute`, and `reconcile`.

Each constructed audit or SQLite path retains its parent directory's exact device/inode identity. For a missing file, the shared guard keeps the validated parent descriptor open, passes it as descriptor 3 to a fixed child, and checks that the child's already-established working directory has the same identity before creating only a simple filename there. A replacement before the child check is rejected; a later POSIX rename cannot redirect creation out of the original directory. Windows relies on its current-directory rename lock, tested separately on a native Windows runner. The caller reopens without creation flags and checks identity before returning a writable descriptor. An interrupted operation may leave an empty file in the original directory, but must not add a file to a replacement directory.

The `NotificationStore` `platform` option is test support only and must match the operating system running the process. A public caller cannot use it to weaken POSIX ownership, permission, or link checks, and it cannot bypass the Windows disk-backed SQLite fail-closed boundary. Path-only helper functions keep their separate simulation boundary.

This is a file-creation guarantee, not proof that SQLite's later pathname-based opens and sidecars are bound to the guard descriptor. Disk-backed `NotificationStore` remains POSIX-only because Windows `DatabaseSync` has no bindable file handle; `:memory:` remains available on Windows. The public hotel demo uses browser storage and does not depend on this notification-only disk restriction.

Creation contract `eeccc01c-0134-5420-9946-9efe2adbb772`: `PARENT_RECHECK_INSUFFICIENT -> RETAINED_PARENT_WORKING_DIRECTORY_CREATION`, observed `2026-08-30T01:23:53.958Z`, event `01a05044-13e6-7415-b86e-0a3c1ef4634d`. The descriptor-bound race contract `e8dfa4b3-a12e-5e5c-b5b0-f0c5f879d8b2` records `PATH_BOUND_CREATE_RACE -> DESCRIPTOR_VERIFIED_CHILD_CREATE` at `2026-08-30T04:07:24.050Z`, event `01a050d9-b310-759a-8f13-ba61b21f506e`. The regression file is [`notification-parent-creation.test.ts`](../src/typescript/test/notification-parent-creation.test.ts). Platform basis: [Apple relative-path semantics](https://developer.apple.com/library/archive/documentation/System/Conceptual/ManPages_iPhoneOS/man2/chdir.2.html), [Microsoft current-directory locking](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-setcurrentdirectory), and [Node.js child working directories](https://nodejs.org/download/release/v24.0.0/docs/api/child_process.html#child_processspawnsynccommand-args-options).

```text
DISCOVERED -> PROPOSED -> DRY_RUN -> USER_APPROVED -> EXECUTING -> VERIFIED
                    |             |                 |-> ABORTED
                    |             |-> REJECTED

NOT_STARTED -> AMBIGUOUS -> RECONCILING -> CONFIRMED_PRESENT
                                      |-> CONFIRMED_ABSENT
```

Machine contract: `AMBIGUOUS` permits reconciliation only. Current absence does not prove that a notification was never shown earlier, so an unknown historical start remains blocked. After explicit pre-effect non-start and independent current absence establish `CONFIRMED_ABSENT`, replay still requires six fresh checks: authorization, host permission, implementation version, bound user consent, lifetime, and the independently observed precondition. One failure stops before a second effect claim.

Restoration never enables an effect-bearing control from lifecycle state alone. Approval, retry, and reconciliation also require the measured SQLite effect-start count to satisfy the state invariant. An expired `USER_APPROVED / NOT_STARTED` record is cleared back to `DRY_RUN / NOT_STARTED`; no effect can begin until a new UUIDv7 approval record is stored.

The static browser version binds the normalized dry-run input, UUIDv5 intent ID, and payload digest into one immutable approval target. Editing any field invalidates approval immediately. A notification-permission result can apply only to the target captured before the wait. After reload, `USER_APPROVED / NOT_STARTED` resumes the same persisted binding at most once.

A tool result is stored only as a recorded claim. Verification requires a distinct adapter or Service Worker readback. The recorded claim and the independently estimated truth remain separate in the SQLite effect receipt.

Execution claims and conservative effect starts are separate as well. `STARTED` and `UNKNOWN` each consume one count. Only an explicit pre-effect `NOT_STARTED` assessment plus independent absence contributes zero while remaining auditable. If one later replay succeeds, the conservative count is one rather than two.

## Run locally

```bash
uv sync --frozen
cd src/typescript && npm ci && cd ../..
make validate
make benchmark-notification
make demo
```

Open `http://127.0.0.1:4173`. Preview is side-effect free. The browser asks for notification permission only from the explicit approval click. The notification tag equals the UUIDv5 intent ID, and `getNotifications()` provides independent readback before the intent becomes `VERIFIED`.

Automated coverage includes success, failure before effect, timeout after effect, ambiguous-state retry rejection, reconciliation, restart persistence, approval expiry and reapproval, contradictory restored counts, visible-input changes, permission-wait races, approved-state resume, distinct logical operations with identical content, all six replay checks, tool-claim rejection without readback, fabricated browser counts and tags, and 100 healthy simulated runs.

On 2026-08-28 this Mac measured a `8.99 ms` p95 across 100 simulated samples, below the `2,000 ms` bound. The environment and every sample are stored in [`metadata/notification-demo-latency.json`](../metadata/notification-demo-latency.json) and [`data/timeseries/notification-demo-latency.ndjson`](../data/timeseries/notification-demo-latency.ndjson). This is not a browser-notification latency measurement.

## Duplicate-prevention visualization

The candidate page shows the initial request and same-operation retry converging on one `Intent ID` ledger, with only the second effect stopped. The count is read from the SQLite effect ledger rather than hard-coded; a value above one is rendered as a safety violation. A compact six-check rail shows why replay is allowed, stopped, unnecessary, or waiting for reconciliation. The screen contract is recorded in [`14-notification-visualization.ja.md`](14-notification-visualization.ja.md), and the dry-run browser evidence is [`metadata/replay-independent-verification.json`](../metadata/replay-independent-verification.json). This implementation change did not display another real notification.

## Live Mac evidence

On 2026-08-28, Google Chrome `152.0.7977.64` displayed one notification tagged with UUIDv5 intent ID `03c9c953-71ea-5405-b1eb-3c0536e78ec1`. Service Worker readback returned one active notification, SQLite contained one external-effect claim, and retrying the same logical operation returned `ALREADY_VERIFIED` without a second claim. The final state was `VERIFIED / CONFIRMED_PRESENT`, and all six public JSON Lines audit entries form a valid hash chain.

The public evidence is [`metadata/notification-demo-live-verification.json`](../metadata/notification-demo-live-verification.json) and [`data/audit/notification-demo-live-events.ndjson`](../data/audit/notification-demo-live-events.ndjson). External-service cost was zero. This is local observation plus Service Worker readback, not remote attestation. The immutable six-entry evidence belongs to the `0.2.0` implementation. The current reference path adds an explicit reconciliation transition and is simulation-tested; no new real notification was emitted for this change.

Codex's in-app browser exposed `document.modelContext` and registered `notify_once` during the visual check. Native WebMCP conformance across target browsers, including execution, permission, and contamination controls, remains `INCONCLUSIVE`. Node.js 24 documents `node:sqlite` at release-candidate stability. Primary sources: [WHATWG Notifications API](https://notifications.spec.whatwg.org/), [Node.js SQLite](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html), [SQLite transactions](https://www.sqlite.org/lang_transaction.html), and the [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/).
