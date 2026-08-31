---
title: "Validation Report / 検証報告"
language: "ja-en"
stable_uuid_v5: "a6b95fb5-3315-581f-8c52-faf489415b1e"
event_uuid_v7: "01a04291-c4d4-729d-b9a2-d5cdbe2705b3"
updated_event_uuid_v7: "01a04948-c160-7499-9ba6-5e1dca93814a"
live_verification_event_uuid_v7: "01a04896-44e2-7ad8-9c68-587631dc4945"
browser_visual_verification_event_uuid_v7: "01a048c2-028c-70c7-ab61-69ac805348df"
offline_sync_verification_event_uuid_v7: "01a04927-46cd-765b-912f-a63737578d9e"
online_planner_verification_event_uuid_v7: "01a04948-c160-7499-9ba6-5e1dca93814a"
final_verification_event_uuid_v7: "01a049d1-b7e1-7443-a30b-4620165c8b17"
final_validation_event_uuid_v7: "01a049e8-9210-7989-b9a4-d58448cf6925"
review_reconciliation_event_uuid_v7: "01a04a11-70f3-7dd6-8a87-97401a43b74e"
review_followup_event_uuid_v7: "01a04a1b-eac6-7c5c-aa43-c19d4a593bfb"
review_second_followup_event_uuid_v7: "01a04a28-9e04-7709-9ce3-49b9331fd953"
review_third_followup_event_uuid_v7: "01a04a2c-246b-7e0e-bc66-2a7ff653aef0"
review_fourth_followup_event_uuid_v7: "01a04a3b-7a18-7745-9b09-d8e5a2a74866"
review_fifth_followup_event_uuid_v7: "01a04a4c-1be8-7fcc-a67f-5eaff2cc8030"
review_final_verification_event_uuid_v7: "01a04a52-7dd3-7055-ac87-729f8708b6f0"
generated_at: "2026-08-27T09:34:04.500Z"
updated_at: "2026-08-28T19:46:13.648Z"
review_reconciliation_at: "2026-08-28T20:30:52.147Z"
review_followup_at: "2026-08-28T20:42:18.694Z"
review_second_followup_at: "2026-08-28T20:56:11.012Z"
review_third_followup_at: "2026-08-28T21:00:02.027Z"
review_fourth_followup_at: "2026-08-28T21:16:47.000Z"
review_fifth_followup_at: "2026-08-28T21:34:57.000Z"
review_final_verification_at: "2026-08-28T21:41:55.283Z"
version: "1.0.1-candidate"
status: "validation-report"
---

# Validation Report / 検証報告

> **本質 / Essence:** 正常仕様では危険状態が0件。わざと壊すとcounterexampleが出る。つまり「検査器が寝てるだけ」ではない。  
> The baseline has zero prohibited reachable states, while deliberate mutations produce counterexamples. The checker is therefore sensitive to the modeled failures.

## Snapshot / 検証snapshot

- Validator timestamp: `2026-08-28T19:46:13.648138Z`
- Overall: **PASS**
- Error count: `0`
- Validation command: `make validate`
- Machine report: [`metadata/build-report.json`](../metadata/build-report.json)

| Check | Result |
|---|---:|
| `structured_parse` | PASS |
| `local_markdown_links` | PASS |
| `live_notification_evidence` | PASS |
| `json_schema` | PASS |
| `source_graph` | PASS |
| `uuid_v5_v7` | PASS |
| `golden_vectors_python` | PASS |
| `audit_chain_signatures` | PASS |
| `merkle_checkpoint` | PASS |
| `offline_sync_evidence` | PASS |
| `online_planner_evidence` | PASS |
| `slo_gate_evidence` | PASS |
| `no_private_keys` | PASS |
| `reachability_and_mutation` | PASS |
| `typescript_tests` | PASS |
| `typescript_typecheck` | PASS |
| `final_public_evidence` | PASS |
| `wolfram_report` | PASS |

## Knowledge inventory / 知識台帳

| Category | Records |
|---|---:|
| Primary sources / 一次情報源 | 28 |
| Claims / 主張 | 27 |
| Requirements / 要件 | 69 |
| Formulas / 数式 | 55 |
| Verification tests / 検証test | 67 |
| Components / component | 15 |
| Architecture decisions / ADR | 12 |
| Risk classes / risk class | 6 |
| Timeline events / 時系列event | 19 |

## Executable checks / 実行検証

### TypeScript

- 192 Node test cases passed: decision golden vectors, strict UUID checks, canonical JSON constraints, notification approval and duplicate protection, local and WebMCP invocation-isolated status readback, input provenance, measured-count violations, hotel expiry recovery, signed device chains, every retained checkpoint link including missing-parent rejection, external trusted-key anchoring, persistent global ingestion, signed-source chain, decision and row-identity binding, legacy repair, fork and gap rejection, safe-state convergence, dangerous-effect quarantine, optional planner guardrails, operational-quality gates, and all visual state contracts. The exact current hotel candidate count is derived from the Node test summary and compared with the separately observed public count in [`metadata/hotel-release-candidate.json`](../metadata/hotel-release-candidate.json).
- TypeScript language-server-equivalent checking passed with `tsc --noEmit`.
- Sources: [`src/typescript/test/evaluator.test.ts`](../src/typescript/test/evaluator.test.ts), [`src/typescript/test/notification.test.ts`](../src/typescript/test/notification.test.ts), [`src/typescript/test/offline-sync.test.ts`](../src/typescript/test/offline-sync.test.ts), [`src/typescript/test/online-planner.test.ts`](../src/typescript/test/online-planner.test.ts), and the three browser-state tests in [`src/typescript/test`](../src/typescript/test/).

### Current hotel release hard gates

<!-- information_uuid_v5=5dfb6e29-8be6-5ec4-b4b9-1d6a80992d39 event_uuid_v7=01a052f5-03b6-70df-8d85-ef68ea37e2ad state_transition=PUBLIC_RELEASE_DEPLOYED -> FINAL_GATE_RECORDED machine-contract=All five gates use the same committed source and production deployment; the later public alignment record is separate. -->

- Source commit `c8be388d8047472ef7d6ad69656255adb5903e37` passes 192 Node tests with zero failures and zero skips. The Vercel production deployment is `dpl_AdzeHw7CgM3sbsZBVutZZbLLbeAK`, and anonymous retrieval of the public evaluation file matches the local bytes. Evidence: [`metadata/hotel-public-release-readback.json`](../metadata/hotel-public-release-readback.json).
- The focused liveness check proves `PREPARED → EXPIRED → PREPARED` with the same booking identity, a new approval window and digest, one physical booking row, one effect start, and a valid event chain.
- The fresh supported Chrome run exposed `document.modelContext` and exactly four intended WebMCP tools. Discovery created zero bookings, effect starts, external requests, permission requests, or notifications.
- After the visible human confirmation button and intentionally hidden success response, native `get_hotel_booking_status` found the existing result before the visible retry. The final result was `RETRY_RECOGNIZED`, attempts `2`, bookings `1`, effect starts `1`, and the same confirmation number. Evidence: [`metadata/hotel-native-webmcp-reconciliation.json`](../metadata/hotel-native-webmcp-reconciliation.json).
- The current candidate record evaluates `S AND L AND F_exact AND W AND E` as `PASS`. The older [`metadata/devpost-public-readback.json`](../metadata/devpost-public-readback.json) is a historical 153-test snapshot and is not used as the current public claim.

### Current public release alignment

<!-- information_uuid_v5=bded1f61-139c-50b9-a0a1-d5f7901c2915 event_uuid_v7=01a055f0-2130-7abc-8000-000000000abc state_transition=PUBLIC_TARGETS_WITH_STALE_DESCRIPTION -> PUBLIC_TARGETS_AND_DESCRIPTION_ALIGNED occurred_at=2026-08-31T03:49:55.632Z -->

The later [`public-release-alignment-readback.json`](../metadata/public-release-alignment-readback.json) is a separate current observation. It binds submitted ChatGPT Sites version 14, Vercel deployment `dpl_FqcLjo1xbpmRBoNsUA6WMny8L1Eu`, and Devpost version 13 after anonymous and authenticated readback. All three records point to the submitted Site URL and the same 194-test, four-tool contract. It does not claim that the older native browser run was re-executed or that external effects were measured again.

### Optional online planner candidate

- Thirteen deterministic scripted paths covered disabled, offline, required-private-field, secret-looking public value, unknown cost, over-budget cost, healthy candidate, unknown tool, invalid arguments, timeout, response loss, incomplete response, and multiple calls.
- Exactly one healthy response became `UNTRUSTED_PROPOSAL`. Actual network requests, actual external spend, authorization creation, external-effect starts, and automatic retries all remained `0`.
- The public request uses one allowlisted strict function tool, `store=false`, `background=false`, and `parallel_tool_calls=false`. Its context contains only the allowed public `goal` and `channel` fields.
- The evidence generator produced byte-identical evidence, request, and audit files on consecutive runs.
- Independent Python verification checked both JSON Schemas, artifact hashes, UUIDv5/v7 identities and time binding, the 33-event audit hash chain, minimum disclosure, strict tool parameters, seven simulated transport starts, one candidate, and all stop reasons.
- Browser checks at `1440 x 1000` and `390 x 844` found no horizontal overflow. Replaying the visible flow added no resource requests and preserved candidate `1`, authorization `0`, and external effects `0`; console warnings and errors were empty.
- Live Responses API conformance is `INCONCLUSIVE`; current production pricing and production quality are `UNMEASURED`. Evidence: [`metadata/online-planner-verification.json`](../metadata/online-planner-verification.json).

### Two-device offline synchronization candidate

- Two logical devices created independent three-event Ed25519 chains and signed Merkle checkpoints while disconnected.
- Reconnection preserved each device sequence and assigned six global ingestion positions. Re-ingesting the same device chain did not advance the global sequence.
- The add-only tag set converged to `offline-first / shared / verifiable` independent of ingestion order and duplicates.
- Two notification-intent sources became one `HUMAN_REVIEW_REQUIRED` case. External-effect starts and real notifications remained exactly `0`.
- Independent Python verification checked public artifact digests, JSON Schemas, UUIDv7 time binding, both device signatures and hash chains, checkpoints, global ingestion links, and the four quarantine reasons.
- Signature tampering, sequence gap, signed fork, and checkpoint mismatch all stopped before any effect. Evidence: [`metadata/offline-sync-verification.json`](../metadata/offline-sync-verification.json).
- A self-consistent SQLite rewrite signed by a substituted key failed after restart because the key digest no longer matched the separately persisted trust anchor.
- This is a bounded local simulation. Remote transport is unimplemented and production multi-device quality is `UNMEASURED`.

### Duplicate-safe visualization candidate

- A dry run in the Codex in-app browser rendered `DRY_RUN / NOT_STARTED` with an SQLite external-effect start count of `0`; no real notification was requested during this check.
- The desktop `1440 x 1000` view exposed the two paths, measured count, and state ledger. At width `390`, document width equaled viewport width and no horizontal overflow was detected.
- Browser semantics exposed the main region, labeled subregions, headings, labeled inputs, buttons, and a status message. The stylesheet provides a reduced-motion path; browser warning and error logs were empty.
- The final bounded observation separated two surfaces: `document.modelContext` was absent in the observable in-app page scope, while the browser's tab capability discovered `notify_once`. The connected Chrome page scope also lacked `document.modelContext`. Broader native WebMCP conformance remains `INCONCLUSIVE`.

### Final public-evidence candidate

- The connected Chrome page scope and the Codex in-app page scope both reported `document.modelContext` absent. The in-app browser separately discovered the page-defined `notify_once` tool through its tab capability; the tool was not called.
- The independent Python explorer and official TLA+ Tools v1.7.4 run agreed on 38 distinct reachable states. Both found zero unauthorized execution, double effect, unverified commit, or retry while ambiguous.
- The current environment had no Wolfram runtime, so current Wolfram execution is `NOT_EXECUTED`. The captured report remains checked, and exact Python fraction arithmetic independently reproduced its sample.
- The test catalog contains 67 implemented and automated records, with zero partial or specification-only records.
- This final observation created zero tool calls, notification-permission requests, notifications, observed-page external requests, intent rows, attempt rows, effect rows, and audit events.
- The tracked record intentionally remains `READY_FOR_PUBLIC_READBACK`; post-merge `main` readback, critical-review readback, and the final secret scan are external completion records. Evidence: [`metadata/final-verification.json`](../metadata/final-verification.json).

### Closed-review reconciliation candidate

- All 50 closed pull requests were scanned. Fourteen historical review threads were still marked unresolved; 2 were already fixed and 12 required current-code changes. Pull request #51 then added 18 actionable findings, all fixed from failing tests, mutation checks, source-contract checks, or browser checks.
- All 32 findings now map to a unique information identifier, the original review URL, current fix paths, and a regression check. Remaining findings are `0`.
- The real page received the same logical operation twice, then overlapped two different dry-run operations. The delayed operation's visible input, intent identifier, and SQLite record agreed. Persisted state remained `DRY_RUN / NOT_STARTED`; effect starts, notification-permission requests, notifications, external requests, and console errors all remained `0`.
- Native WebMCP conformance remains `INCONCLUSIVE`, and production quality remains `UNMEASURED`. Evidence: [`metadata/review-thread-reconciliation.json`](../metadata/review-thread-reconciliation.json).

### Duplicate-safe notification candidate

- The simulated adapter started at most one visible effect for one logical operation across duplicate retry, response loss, and restart tests.
- 100 simulated healthy runs measured `8.99 ms` at the 95th percentile against a `2,000 ms` limit. Environment and all samples are preserved in [`metadata/notification-demo-latency.json`](../metadata/notification-demo-latency.json) and [`data/timeseries/notification-demo-latency.ndjson`](../data/timeseries/notification-demo-latency.ndjson).
- One real Mac browser notification was displayed after immediate user approval. Service Worker readback returned one active notification, the same-operation retry returned `ALREADY_VERIFIED`, and the SQLite external-effect claim count remained one.
- The six-event public hash chain and machine-readable summary are [`data/audit/notification-demo-live-events.ndjson`](../data/audit/notification-demo-live-events.ndjson) and [`metadata/notification-demo-live-verification.json`](../metadata/notification-demo-live-verification.json). The validator independently checks the chain, UUID versions and times, final states, one claim, and the suppressed retry.
- Native WebMCP availability remains `INCONCLUSIVE`.

### Finite reachability model

Baseline with `maxRetry=2`:

- reachable states: `38`
- transitions: `43`
- unauthorized execution states: `0`
- double-effect states: `0`
- commit-without-verification states: `0`
- ambiguous retry edges: `0`
- valid commit reachable: `true`

Mutation sensitivity:

| Mutation | Detected counterexamples |
|---|---:|
| Unauthorized execution | 1 |
| Double effect | 12 |
| Commit bypass | 3 |
| Ambiguous retry | 10 |

Full report: [`formal/model-checker/report.json`](../formal/model-checker/report.json).

### Audit integrity

The validator independently checks:

- strict integer-only canonical JSON subset;
- SHA-256 event digests and hash-chain continuity;
- Ed25519 event signatures using bundled **public keys only**;
- Merkle root and inclusion proof;
- signed checkpoint;
- absence of private-key material.

### Wolfram reference

The package includes [`formal/wolfram/ReferenceModel.wl`](../formal/wolfram/ReferenceModel.wl) and a captured kernel result in [`verification-report.json`](../formal/wolfram/verification-report.json). The offline validator checks the captured probability-mass identity and independently reproduces the sample with exact rational arithmetic. It does **not** start a Wolfram kernel, and the final record says `NOT_EXECUTED` for the current Wolfram run.

## Known verification boundary / 検証境界

TLA+ source and TLC configuration are included, but the TLC binary is not bundled or executed by `make validate`. Therefore:

- the independent Python finite abstraction **was executed**;
- the TypeScript and cryptographic checks **were executed**;
- an official TLA+ Tools v1.7.4 run **was executed and captured** for the final evidence;
- `make validate` checks the captured engine identity, source hashes, settings, result, and agreement with the independent explorer;
- `make verify-tla TLA2TOOLS_JAR=/absolute/path/to/tla2tools.jar` performs a fresh TLC reproduction.

See [`formal/tla/README.md`](../formal/tla/README.md).
