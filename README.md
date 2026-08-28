---
title: "Verifiable Offline WebMCP Agent Architecture / 検証可能なオフライン WebMCP エージェント設計"
language: "ja-en"
stable_uuid_v5: "5c98b5f4-c536-532d-a8ac-e2d88397a006"
event_uuid_v7: "01a04291-b452-750e-a9e5-19fbca156cb5"
updated_event_uuid_v7: "01a048c2-e2b4-71da-a6c7-c5269c9b69d3"
provenance_event_uuid_v7: "01a04904-ca9b-7c0b-8987-01c2078e6b4c"
offline_sync_event_uuid_v7: "01a04927-4629-774e-a927-d87c66c1aa09"
online_planner_event_uuid_v7: "01a04948-c160-716f-ba38-d5125fd214b6"
security_boundary_event_uuid_v7: "01a04967-af58-747f-852e-830783019817"
replay_verification_event_uuid_v7: "01a0497e-f947-7442-b95c-2eed7476e477"
replay_browser_event_uuid_v7: "01a04987-5d7c-7ebe-9208-c468f5c24ebf"
effect_accounting_event_uuid_v7: "01a0498b-5662-7094-9bef-88e9b2f13a10"
effect_start_semantics_event_uuid_v7: "01a04993-3867-7e11-b120-01b3bab8ec62"
slo_gate_event_uuid_v7: "01a049ad-1379-780b-9344-3df2682e855c"
slo_gate_review_fix_event_uuid_v7: "01a049ba-c4e3-753e-8c7d-c353034a2a3b"
final_verification_event_uuid_v7: "01a049d1-b7e1-7443-a30b-4620165c8b17"
generated_at: "2026-08-27T09:34:00Z"
updated_at: "2026-08-28T18:56:12.003Z"
version: "0.1.0"
status: "design-specification"
---

# Verifiable Offline WebMCP Agent Architecture
# 検証可能なオフライン WebMCP エージェント設計

**Version:** `0.1.0` · **Generated:** `2026-08-27T09:34:00Z` · **Root UUID namespace:** `47f3e535-0e27-559a-9556-aa79a84f95eb`

> **本質だけ言う / The essence:** **The LLM proposes; policy permits; WebMCP acts; evidence verifies; events remember; cryptography binds.**
>
> **LLMは案を出すだけ。許可は数理policy、実行はWebMCP、成功判定は証拠。ログは後から盛れない形でbindする。**

This repository is a bilingual, GitHub-ready design specification for a mobile-first, offline-capable, verifiable agent architecture. It is **Open Knowledge–style**, using JSON-LD, PROV-O, DCAT-like catalog metadata, JSON Schema, UUIDv5/v7, machine-readable claims/formulas/requirements, formal models, and executable reference code. It does **not** claim conformance to a single official standard named “Open Knowledge Format.”

このリポジトリは、モバイル優先・オフライン対応・検証可能なエージェント設計を、英日併記、JSON-LD、PROV-O、DCAT風catalog、JSON Schema、UUIDv5/v7、形式仕様、実行可能な参照コードでまとめたものです。「Open Knowledge Format」という単一の公式標準への適合を主張するものではありません。

> **公開状態 / Public status:** これは設計仕様と参照実装であり、実働製品ではありません。`0.2.0`の二重送信防止通知デモは、このMacで実通知1件と同一操作再試行後の1件維持まで検証済みです。ネイティブWebMCP対応は引き続き`INCONCLUSIVE`です。既知の欠陥と未実装範囲は[GitHub Issues](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/issues)で公開します。

## Architectural stance / 設計の立場

| Layer | 日本語 | English |
|---|---|---|
| WebMCP | 構造化された主要行動基盤 | Primary structured action substrate |
| Responses API | オンライン時だけ使えるoptional planner | Optional online planner |
| Tool Contract Engine | ALLOW / DENY / HUMAN / RECONCILEの決定権者 | Decision authority |
| Evidence Engine | toolの自己申告ではなく現実を検証 | Verifies reality, not only tool claims |
| EFSM / TLA+ | 危険状態を到達不能にする | Makes dangerous states unreachable |
| Signed Event Log | provenance、replay、tamper evidence | Provenance, replay, and tamper evidence |
| SLO Optimizer | 安全制約内でthreshold/budgetを最適化 | Optimizes thresholds and budgets under safety constraints |

> **ここ、事故るポイント / This is where things break:** `timeout != failure`. UNKNOWNな副作用をそのままretryすると、二重送金・二重送信になる。だから `AMBIGUOUS → RECONCILE → KNOWN` を強制する。

## Start here / 読む順番

1. [`DESIGN_SPEC.md`](DESIGN_SPEC.md) — integrated bilingual specification / 英日統合仕様
2. [`docs/00-executive-summary.ja.md`](docs/00-executive-summary.ja.md) / [`en`](docs/00-executive-summary.en.md)
3. [`docs/specification.ja.md`](docs/specification.ja.md) / [`en`](docs/specification.en.md)
4. [`docs/source-map.md`](docs/source-map.md), [`docs/test-catalog.md`](docs/test-catalog.md), and [`docs/validation-report.md`](docs/validation-report.md)
5. [`knowledge/project.json`](knowledge/project.json) and [`knowledge/graph.jsonld`](knowledge/graph.jsonld)
6. [`formal/tla/ToolExecution.tla`](formal/tla/ToolExecution.tla)
7. [`src/typescript/evaluator.ts`](src/typescript/evaluator.ts)
8. [`docs/13-notification-demo.ja.md`](docs/13-notification-demo.ja.md) / [`en`](docs/13-notification-demo.en.md) — duplicate-safe local notification reference
9. [`docs/14-notification-visualization.ja.md`](docs/14-notification-visualization.ja.md) — two requests to one measured effect, visualized / 二要求を一効果へ収束する画面契約
10. [`docs/15-webmcp-input-boundary.ja.md`](docs/15-webmcp-input-boundary.ja.md) — strict WebMCP input projection / WebMCP入力の厳格投影
11. [`docs/16-webmcp-provenance-adapter.ja.md`](docs/16-webmcp-provenance-adapter.ja.md) — isolated draft adapter and durable provenance / 専用アダプターと来歴読み戻し
12. [`docs/17-offline-sync-reference.ja.md`](docs/17-offline-sync-reference.ja.md) — signed two-device reconciliation with dangerous-effect quarantine / 署名付き二端末同期と危険な外部効果の隔離
13. [`docs/18-online-planner-reference.ja.md`](docs/18-online-planner-reference.ja.md) — optional candidate planner with tool, privacy, cost, latency, and authority boundaries / 道具・情報・費用・遅延・権限を制限した任意計画器
14. [`docs/19-slo-gate-reference.ja.md`](docs/19-slo-gate-reference.ja.md) — six hard operational-quality gates with deterministic counterexamples / 6つの運用品質判定と固定した反例
15. [`formal/wolfram/ReferenceModel.wl`](formal/wolfram/ReferenceModel.wl)
16. [`docs/20-final-verification.ja.md`](docs/20-final-verification.ja.md) — bounded browser observation, two formal checks, and the 67-test public-evidence boundary / ブラウザー実測・二つの形式検証・67件の公開証拠境界
17. [`docs/21-review-thread-reconciliation.ja.md`](docs/21-review-thread-reconciliation.ja.md) — 32 review findings bound to fixes and regression evidence / 32件のレビューを修正と回帰証拠へ結合

## Machine-readable assets / 機械可読asset

- `knowledge/*.json` — sources, claims, formulas, requirements, tests, decisions, components, risk classes, timeline, provenance
- `knowledge/*.jsonld` — linked graph and context
- `schemas/*.schema.json` — structural contracts
- `data/golden-vectors.json` — conformance vectors
- `data/timeseries/*.ndjson` — source/design/runtime time series
- `data/audit/*.json|ndjson` — signed sample log, Merkle checkpoint, inclusion proof, tamper report
- `metadata/file-catalog.json` — UUIDv5/v7 and temporal metadata for every project file
- `metadata/final-verification.json` — bounded WebMCP observation, formal results, 67-test count, and zero-effect final evidence
- `MANIFEST.sha256` — artifact integrity manifest

The four 1.0.0 governance slices bind security, replay, operational-quality, browser-observation, and formal-evidence claims. The catalog contains **67 implemented and automated tests, with no partial or specification-only records**. Critical commit tools remain inside policy control; replay requires six fresh checks; an external effect needs independent readback rather than a tool claim alone; and six hard mathematical gates stop unsafe capacity, calibration, probability, or provenance inputs. Production operational quality remains `UNMEASURED`, and native WebMCP conformance remains `INCONCLUSIVE`. See [`src/typescript/governance/security-boundary.ts`](src/typescript/governance/security-boundary.ts), [`src/typescript/governance/replay-verification.ts`](src/typescript/governance/replay-verification.ts), [`src/typescript/governance/slo-gates.ts`](src/typescript/governance/slo-gates.ts), [`metadata/final-verification.json`](metadata/final-verification.json), and [`docs/test-catalog.md`](docs/test-catalog.md).

## Validation / 検証

```bash
make validate
```

The validation pipeline parses all JSON/NDJSON/YAML, checks schemas and cross-references, verifies UUID versions and UUIDv7 timestamps, runs TypeScript golden vectors, verifies Ed25519 signatures/hash chains/Merkle roots, runs the independent reachability model, and rebuilds the final evidence in memory for a byte-for-byte comparison.

`make validate` only checks tracked artifacts; it does not regenerate them. After an intentional source change, run `make regenerate`, review the diff, and then run `make validate` twice. Dependency versions are fixed by `uv.lock`, `src/typescript/package-lock.json`, `.python-version`, and `.node-version`.

## Duplicate-safe notification demo / 二重送信防止通知デモ

The `0.2.0` reference demo stores notification intent, attempts, and effect state in SQLite. A UUIDv5 intent ID is derived from the logical operation, every state change or suppressed retry gets a UUIDv7 event ID, and a hash-chained JSON Lines audit record is appended before an external adapter call. `AMBIGUOUS` never retries directly; only reconciliation is allowed. A retry after `CONFIRMED_ABSENT` now requires fresh authorization, host permission, implementation version, bound consent, lifetime, and precondition evidence. The recorded execution claim remains separate from both the truth estimate and the conservative effect-start count. `STARTED` and `UNKNOWN` each count as one; only an explicit pre-effect `NOT_STARTED` assessment plus independent absence counts as zero. A later current-absence readback cannot erase a possibly earlier display.

```bash
uv sync --frozen
cd src/typescript && npm ci && cd ../..
make validate
make benchmark-notification
make demo
```

Open `http://127.0.0.1:4173`. The page first shows a dry run. A real Mac browser notification is requested only after an explicit click, and the same logical operation is then retried to prove that a second effect is blocked. If `document.modelContext` is absent, native WebMCP support remains `INCONCLUSIVE`; the same typed local path stays usable.

The candidate screen makes that safety path visible: the first request and retry converge on the same intent ledger, while the count card reads the conservative SQLite effect-start ledger and exposes any value above one as a safety violation. A compact six-check rail also shows why a replay is allowed, stopped, unnecessary, or waiting for reconciliation. Desktop and 390-pixel-wide browser checks are documented in [`docs/14-notification-visualization.ja.md`](docs/14-notification-visualization.ja.md), with machine-readable dry-run evidence in [`metadata/replay-independent-verification.json`](metadata/replay-independent-verification.json). In the final bounded observation, the Codex in-app browser discovered `notify_once` through its tab capability, while `document.modelContext` was absent in both the in-app page scope and the connected Chrome page scope. These observations are intentionally separate; broader native WebMCP conformance remains `INCONCLUSIVE`.

The draft WebMCP surface is isolated in one notification adapter. External input provenance is derived from the server route, persisted with the first intent-created event, and independently read back before the browser shows a match. A same-operation request from another channel keeps the first provenance and creates no external effect. See [`metadata/webmcp-provenance-verification.json`](metadata/webmcp-provenance-verification.json); this bounded browser observation does not claim general WebMCP conformance.

The 2026-08-28 live run finished `VERIFIED / CONFIRMED_PRESENT`: Service Worker readback found one notification, the same-operation retry returned `ALREADY_VERIFIED`, the SQLite effect-start count remained one, and the six-event public audit chain validates. See [`metadata/notification-demo-live-verification.json`](metadata/notification-demo-live-verification.json) and [`data/audit/notification-demo-live-events.ndjson`](data/audit/notification-demo-live-events.ndjson). That immutable evidence belongs to the `0.2.0` implementation. The newer independent-verification path adds an explicit reconciliation transition and is currently covered by simulation; this change did not emit another real notification.

## Offline sync evidence demo / オフライン同期証拠デモ

The `0.4.0` reference implementation creates two independent Ed25519-signed device chains, verifies signed Merkle checkpoints, preserves each device sequence while assigning a global ingestion sequence, and detects tampering, gaps, and forks. Only an add-only tag set is merged. Two notification intents become one `HUMAN_REVIEW_REQUIRED` case with **zero notification starts**; the synchronizer exposes no notification execution route.

```bash
make validate
make demo-sync
```

Open `http://127.0.0.1:4174`. The screen is read-only and replays the public evidence as two offline lanes converging through a signature gate. The bounded local simulation is verified; remote transport is unimplemented, production multi-device quality is `UNMEASURED`, and native WebMCP integration remains `INCONCLUSIVE`. See [`metadata/offline-sync-verification.json`](metadata/offline-sync-verification.json) and [`docs/17-offline-sync-reference.ja.md`](docs/17-offline-sync-reference.ja.md).

## Optional online planner evidence demo / 任意オンライン計画器の証拠デモ

The `0.5.0` reference boundary keeps the local path available, exposes only feasible proposal-only tools, removes personal and secret fields, rejects secret-looking public values, and requires a trusted operator-supplied rate card before transport. A completed response becomes only an `UNTRUSTED_PROPOSAL`; it cannot create approval or start an external effect. Timeout and response loss stop without an automatic retry.

```bash
make evidence-planner
make validate
make demo-planner
```

Open `http://127.0.0.1:4175`. The read-only screen shows one simulated candidate ending at a hard boundary before approval and external effect. Thirteen deterministic scenarios produced actual network requests `0`, actual spend `0`, authorization `0`, external effects `0`, and automatic retries `0`. Live Responses API conformance remains `INCONCLUSIVE`; current production pricing and quality are `UNMEASURED`. See [`metadata/online-planner-verification.json`](metadata/online-planner-verification.json) and [`docs/18-online-planner-reference.ja.md`](docs/18-online-planner-reference.ja.md).

## Operational-quality gate evidence / 運用品質判定の証拠

Six hard gates check service capacity, Little's queueing relation, validation-data calibration, probability-mass conservation, bad-commit and duplicate-effect limits, and synthetic-versus-measured provenance separation. Any failed gate returns `STOP`; evidence observed after the evaluation instant also stops. A high objective score cannot override either probability limit, and model self-reported confidence is never used.

```bash
make evidence-slo
make validate
```

The public evidence is a deterministic synthetic fixture with six passing gates and fixed failing counterexamples. It generated no runtime measurement, external effect, or external spend. Production availability, latency, calibration, bad-commit probability, and duplicate-effect probability remain `UNMEASURED`. See [`metadata/slo-gate-verification.json`](metadata/slo-gate-verification.json) and [`docs/19-slo-gate-reference.ja.md`](docs/19-slo-gate-reference.ja.md).

## Final public evidence / 最終公開証拠

The final evidence keeps three boundaries visible instead of flattening them into one claim: the in-app browser's bounded tool discovery is `CONFIRMED_PRESENT`; the standard `document.modelContext` surface was `CONFIRMED_ABSENT` in the observed Chrome page scope; general native WebMCP conformance and version remain `INCONCLUSIVE`. The observed page called no WebMCP tool, made no external page request, requested no notification permission, emitted no notification, and left intent, attempt, effect, and audit counts at zero.

The independent Python explorer reached 38 states with no prohibited state, and an official TLA+ Tools v1.7.4 / TLC 2.19 run found the same 38 distinct states with no invariant error. No Wolfram runtime was available for the current run, so current Wolfram execution is `NOT_EXECUTED`; the captured report is checked separately with exact rational arithmetic. All 67 catalog records are implemented and automated. See [`metadata/final-verification.json`](metadata/final-verification.json) and [`docs/20-final-verification.ja.md`](docs/20-final-verification.ja.md).

```bash
make evidence-final
make verify-tla TLA2TOOLS_JAR=/absolute/path/to/tla2tools.jar
```

The tracked evidence stops at `READY_FOR_PUBLIC_READBACK`. Post-merge `main` readback, unresolved critical-defect count, and the final secret scan belong in the external Issue #45 verification record because a commit cannot honestly attest to its own future public state.

## Primary-source posture / 一次情報源の扱い

The source registry pins official specifications and original papers. WebMCP is explicitly treated as a draft and isolated behind an adapter. Current source metadata is in [`knowledge/sources.json`](knowledge/sources.json), with a human-readable map in [`docs/source-map.md`](docs/source-map.md).

## License

Apache-2.0 for repository content unless otherwise noted. Referenced external specifications and papers remain under their own terms; this repository includes links, metadata, and paraphrases only.
