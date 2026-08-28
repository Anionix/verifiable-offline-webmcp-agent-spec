---
title: "Validation Report / 検証報告"
language: "ja-en"
stable_uuid_v5: "a6b95fb5-3315-581f-8c52-faf489415b1e"
event_uuid_v7: "01a04291-c4d4-729d-b9a2-d5cdbe2705b3"
updated_event_uuid_v7: "01a04932-2df3-7b67-8676-2471c29a7da5"
live_verification_event_uuid_v7: "01a04896-44e2-7ad8-9c68-587631dc4945"
browser_visual_verification_event_uuid_v7: "01a048c2-028c-70c7-ab61-69ac805348df"
offline_sync_verification_event_uuid_v7: "01a04927-46cd-765b-912f-a63737578d9e"
generated_at: "2026-08-27T09:34:04.500Z"
updated_at: "2026-08-28T16:27:00.467Z"
version: "0.4.0-candidate"
status: "validation-report"
---

# Validation Report / 検証報告

> **本質 / Essence:** 正常仕様では危険状態が0件。わざと壊すとcounterexampleが出る。つまり「検査器が寝てるだけ」ではない。  
> The baseline has zero prohibited reachable states, while deliberate mutations produce counterexamples. The checker is therefore sensitive to the modeled failures.

## Snapshot / 検証snapshot

- Validator timestamp: `2026-08-28T16:27:26.974564Z`
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
| `no_private_keys` | PASS |
| `reachability_and_mutation` | PASS |
| `typescript_tests` | PASS |
| `typescript_typecheck` | PASS |
| `wolfram_report` | PASS |

## Knowledge inventory / 知識台帳

| Category | Records |
|---|---:|
| Primary sources / 一次情報源 | 26 |
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

- 54 Node test cases passed: decision golden vectors, strict UUID checks, canonical JSON constraints, notification approval and duplicate protection, WebMCP input provenance, signed device chains, linked repeated checkpoints, persistent global ingestion, fork and gap rejection, safe-state convergence, dangerous-effect quarantine, and both visual state contracts.
- TypeScript language-server-equivalent checking passed with `tsc --noEmit`.
- Sources: [`src/typescript/test/evaluator.test.ts`](../src/typescript/test/evaluator.test.ts), [`src/typescript/test/notification.test.ts`](../src/typescript/test/notification.test.ts), [`src/typescript/test/offline-sync.test.ts`](../src/typescript/test/offline-sync.test.ts), and the two browser-state tests in [`src/typescript/test`](../src/typescript/test/).

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
- `document.modelContext` and `notify_once` registration were observed in the Codex in-app browser. Broader native WebMCP conformance remains `INCONCLUSIVE`.

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

The package includes [`formal/wolfram/ReferenceModel.wl`](../formal/wolfram/ReferenceModel.wl) and a captured kernel result in [`verification-report.json`](../formal/wolfram/verification-report.json). The offline validator checks the captured probability-mass identity. It does **not** start a Wolfram kernel.

## Known verification boundary / 検証境界

TLA+ source and TLC configuration are included, but TLC is not bundled or executed by `make validate`. Therefore:

- the independent Python finite abstraction **was executed**;
- the TypeScript and cryptographic checks **were executed**;
- the TLA+ model **is supplied for external TLC execution**, not claimed as executed in this package build.

See [`formal/tla/README.md`](../formal/tla/README.md).
