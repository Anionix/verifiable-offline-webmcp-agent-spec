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
generated_at: "2026-08-27T09:34:04.500Z"
updated_at: "2026-08-28T19:46:13.648Z"
version: "1.0.0-candidate"
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

- 89 Node test cases passed: decision golden vectors, strict UUID checks, canonical JSON constraints, notification approval and duplicate protection, WebMCP input provenance, signed device chains, linked repeated checkpoints, persistent global ingestion, fork and gap rejection, safe-state convergence, dangerous-effect quarantine, optional planner guardrails, operational-quality gates, and all visual state contracts.
- TypeScript language-server-equivalent checking passed with `tsc --noEmit`.
- Sources: [`src/typescript/test/evaluator.test.ts`](../src/typescript/test/evaluator.test.ts), [`src/typescript/test/notification.test.ts`](../src/typescript/test/notification.test.ts), [`src/typescript/test/offline-sync.test.ts`](../src/typescript/test/offline-sync.test.ts), [`src/typescript/test/online-planner.test.ts`](../src/typescript/test/online-planner.test.ts), and the three browser-state tests in [`src/typescript/test`](../src/typescript/test/).

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
