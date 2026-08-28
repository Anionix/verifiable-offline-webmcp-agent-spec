---
title: "Verifiable Offline WebMCP Agent Architecture / 検証可能なオフライン WebMCP エージェント設計"
language: "ja-en"
stable_uuid_v5: "5c98b5f4-c536-532d-a8ac-e2d88397a006"
event_uuid_v7: "01a04291-b452-750e-a9e5-19fbca156cb5"
updated_event_uuid_v7: "01a048c2-e2b4-71da-a6c7-c5269c9b69d3"
provenance_event_uuid_v7: "01a04904-ca9b-7c0b-8987-01c2078e6b4c"
offline_sync_event_uuid_v7: "01a04927-4629-774e-a927-d87c66c1aa09"
online_planner_event_uuid_v7: "01a04948-c160-716f-ba38-d5125fd214b6"
generated_at: "2026-08-27T09:34:00Z"
updated_at: "2026-08-28T16:15:05.929Z"
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
14. [`formal/wolfram/ReferenceModel.wl`](formal/wolfram/ReferenceModel.wl)

## Machine-readable assets / 機械可読asset

- `knowledge/*.json` — sources, claims, formulas, requirements, tests, decisions, components, risk classes, timeline, provenance
- `knowledge/*.jsonld` — linked graph and context
- `schemas/*.schema.json` — structural contracts
- `data/golden-vectors.json` — conformance vectors
- `data/timeseries/*.ndjson` — source/design/runtime time series
- `data/audit/*.json|ndjson` — signed sample log, Merkle checkpoint, inclusion proof, tamper report
- `metadata/file-catalog.json` — UUIDv5/v7 and temporal metadata for every project file
- `MANIFEST.sha256` — artifact integrity manifest

## Validation / 検証

```bash
make validate
```

The validation pipeline parses all JSON/NDJSON/YAML, checks schemas and cross-references, verifies UUID versions and UUIDv7 timestamps, runs TypeScript golden vectors, verifies Ed25519 signatures/hash chains/Merkle roots, and runs the independent reachability model.

`make validate` only checks tracked artifacts; it does not regenerate them. After an intentional source change, run `make regenerate`, review the diff, and then run `make validate` twice. Dependency versions are fixed by `uv.lock`, `src/typescript/package-lock.json`, `.python-version`, and `.node-version`.

## Duplicate-safe notification demo / 二重送信防止通知デモ

The `0.2.0` reference demo stores notification intent, attempts, and effect state in SQLite. A UUIDv5 intent ID is derived from the logical operation, every state change or suppressed retry gets a UUIDv7 event ID, and a hash-chained JSON Lines audit record is appended before an external adapter call. `AMBIGUOUS` never retries directly; only reconciliation is allowed.

```bash
uv sync --frozen
cd src/typescript && npm ci && cd ../..
make validate
make benchmark-notification
make demo
```

Open `http://127.0.0.1:4173`. The page first shows a dry run. A real Mac browser notification is requested only after an explicit click, and the same logical operation is then retried to prove that a second effect is blocked. If `document.modelContext` is absent, native WebMCP support remains `INCONCLUSIVE`; the same typed local path stays usable.

The `0.3.0` candidate screen makes that safety path visible: the first request and retry converge on the same intent ledger, while the count card reads the SQLite external-effect claim count and exposes any value above one as a safety violation. Desktop and 390-pixel-wide browser checks are documented in [`docs/14-notification-visualization.ja.md`](docs/14-notification-visualization.ja.md). Codex's in-app browser exposed `document.modelContext` and registered `notify_once` during this check; broader native WebMCP conformance remains `INCONCLUSIVE`.

The draft WebMCP surface is isolated in one notification adapter. External input provenance is derived from the server route, persisted with the first intent-created event, and independently read back before the browser shows a match. A same-operation request from another channel keeps the first provenance and creates no external effect. See [`metadata/webmcp-provenance-verification.json`](metadata/webmcp-provenance-verification.json); this bounded browser observation does not claim general WebMCP conformance.

The 2026-08-28 live run finished `VERIFIED / CONFIRMED_PRESENT`: Service Worker readback found one notification, the same-operation retry returned `ALREADY_VERIFIED`, the SQLite effect-start count remained one, and the six-event public audit chain validates. See [`metadata/notification-demo-live-verification.json`](metadata/notification-demo-live-verification.json) and [`data/audit/notification-demo-live-events.ndjson`](data/audit/notification-demo-live-events.ndjson).

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

## Primary-source posture / 一次情報源の扱い

The source registry pins official specifications and original papers. WebMCP is explicitly treated as a draft and isolated behind an adapter. Current source metadata is in [`knowledge/sources.json`](knowledge/sources.json), with a human-readable map in [`docs/source-map.md`](docs/source-map.md).

## License

Apache-2.0 for repository content unless otherwise noted. Referenced external specifications and papers remain under their own terms; this repository includes links, metadata, and paraphrases only.
