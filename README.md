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
service_integration_event_uuid_v7: "01a04aa0-782f-7b3e-8cec-6cb8a87937df"
hotel_booking_event_uuid_v7: "01a04bd0-b895-79bc-8843-f27240958e9a"
source_quality_event_uuid_v7: "01a04b93-947d-7143-8e2a-4ef233e51598"
publication_state_event_uuid_v7: "01a04c50-33a1-7536-aa11-e25a6e5ca58d"
generated_at: "2026-08-27T09:34:00Z"
updated_at: "2026-08-29T06:58:39.649Z"
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

> **公開状態 / Public status:** これは設計仕様と参照実装であり、実働製品ではありません。訪日旅行者向けホテルデモは、所有者限定の[ChatGPT Sites本番URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site)で四つのWebMCP機能、二回の試行から一件への収束、同じ確認番号、再読込まで確認済みです。一般公開、Vercelの更新、実ホテル予約、決済、取消はまだ行っていません。`0.2.0`通知デモの既存証拠は変更せず保存しています。

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
18. [`docs/22-service-integrations.ja.md`](docs/22-service-integrations.ja.md) — eight service boundaries and the everyday value of preventing duplicate sends / 8サービスの境界と二重送信防止の生活価値
19. [`docs/23-hotel-booking-demo.ja.md`](docs/23-hotel-booking-demo.ja.md) — fictional Kyoto hotel retry demo, four-tool boundary, and local verification / 架空の京都宿再送デモ、四機能境界、ローカル検証

## Machine-readable assets / 機械可読asset

- `knowledge/*.json` — sources, claims, formulas, requirements, tests, decisions, components, risk classes, timeline, provenance
- `knowledge/*.jsonld` — linked graph and context
- `schemas/*.schema.json` — structural contracts
- `data/golden-vectors.json` — conformance vectors
- `data/timeseries/*.ndjson` — source/design/runtime time series
- `data/audit/*.json|ndjson` — signed sample log, Merkle checkpoint, inclusion proof, tamper report
- `metadata/file-catalog.json` — UUIDv5/v7 and temporal metadata for every project file
- `metadata/final-verification.json` — bounded WebMCP observation, formal results, 67-test count, and zero-effect final evidence
- `metadata/service-integration-registry.json` — eight official resource services, truthful readiness states, and illustrative duplicate-risk scenarios
- `metadata/hotel-booking-verification.json` — local browser, offline, responsive, and design-fidelity evidence for the fictional hotel demo
- `metadata/demo-video-production.json` — generated-media prompts, service identifiers, billing boundary, local paths, and SHA-256 values without committing the video files
- `MANIFEST.sha256` — artifact integrity manifest

The four 1.0.0 governance slices bind security, replay, operational-quality, browser-observation, and formal-evidence claims. The catalog contains **67 implemented and automated tests, with no partial or specification-only records**. Critical commit tools remain inside policy control; replay requires six fresh checks; an external effect needs independent readback rather than a tool claim alone; and six hard mathematical gates stop unsafe capacity, calibration, probability, or provenance inputs. Production operational quality remains `UNMEASURED`, and native WebMCP conformance remains `INCONCLUSIVE`. See [`src/typescript/governance/security-boundary.ts`](src/typescript/governance/security-boundary.ts), [`src/typescript/governance/replay-verification.ts`](src/typescript/governance/replay-verification.ts), [`src/typescript/governance/slo-gates.ts`](src/typescript/governance/slo-gates.ts), [`metadata/final-verification.json`](metadata/final-verification.json), and [`docs/test-catalog.md`](docs/test-catalog.md).

## Validation / 検証

```bash
make validate
```

The validation pipeline parses all JSON/NDJSON/YAML, checks schemas and cross-references, verifies UUID versions and UUIDv7 timestamps, runs TypeScript golden vectors, verifies Ed25519 signatures/hash chains/Merkle roots, runs the independent reachability model, and rebuilds the final evidence in memory for a byte-for-byte comparison.

`make validate` only checks tracked artifacts; it does not regenerate them. After an intentional source change, run `make regenerate`, review the diff, and then run `make validate` twice. Dependency versions are fixed by `uv.lock`, the root `package-lock.json`, `src/typescript/package-lock.json`, `.python-version`, and `.node-version`.

The bounded source-quality gate uses Oxlint for the hotel JavaScript, Biome for the hotel page markup and styles, and Oxfmt for the newly governed formatting surface. It avoids rewriting historical files while making the current demo mechanically reviewable.

```bash
npm run quality:check
npm run lsp:oxlint
npm run lsp:oxfmt
npm run lsp:biome
```

Each `lsp:*` command starts one code-analysis server for editor integration and keeps running until the editor stops it. The fixed versions and integrity values are recorded in `package-lock.json`.

<!-- information_uuid_v5=81366b7a-5c59-5af5-be85-e988d824320c -->
<!-- event_uuid_v7=01a04aa0-782f-7b3e-8cec-6cb8a87937df state_transition=SERVICE_BOUNDARIES_DOCUMENTED -> EVERYDAY_DUPLICATE_VALUE_VISIBLE occurred_at=2026-08-28T23:07:05.647Z -->
<!-- machine-contract=Every service example is illustrative and unobserved; current deployment state comes from metadata/service-integration-registry.json. -->

## Everyday value of duplicate prevention / 二重送信を防ぐ生活価値

A lost response must not turn one human intention into two real-world effects. The concrete risks are easy to recognize: an OpenAI or Chrome agent repeats a notification or form; a page hosted on Cloudflare, Vercel, Render, or Netlify repeats an alert, job, or booking after a network or process interruption; a Shopify cart receives two items instead of one; or a Devpost submission helper sends the same version update twice. Preventing the second effect reduces extra cost, correction work, confusion, and trust loss.

応答が消えても、1回の意思を現実の2回の結果にしてはいけません。OpenAIやGoogle Chromeでは通知・フォームの再実行、Cloudflare・Vercel・Render・Netlifyでは通信切替、二度押し、処理再開後の警告・仕事・予約の重複、Shopifyでは1個のつもりが2個になるカート操作、Devpostでは版更新通知の重複が想定例です。いずれも各サービスで観測した事故ではなく、設計を確認するための例です。詳細な状態と承認境界は[`docs/22-service-integrations.ja.md`](docs/22-service-integrations.ja.md)、機械可読の正本は[`metadata/service-integration-registry.json`](metadata/service-integration-registry.json)にあります。

今回の限定したローカル確認では、アプリ内ブラウザーから同じ`notify_once`操作を2回呼び、同じUUIDv5 Intentと外部効果開始数`0`を確認しました。これは共通成果物の確認であり、各外部サービスでの本番実証ではありません。

## Fictional Kyoto hotel retry demo / 架空の京都宿・再送デモ

This English-first, Japanese-supported demo answers one ordinary travel problem: the booking reached the device, but the success response disappeared. Dates, adults, rooms, the fictional hotel, and its fixed plan form one UUIDv5 identity; presentation language is excluded. A visible human button alone can commit the simulated booking. A retry then recovers the same confirmation number and displays `2 attempts → 1 simulated booking → 1 confirmation number`.

英語を主表示、日本語を補助表示にした架空予約デモです。料金は一室一泊12,000円、1〜14泊、大人1〜4人、部屋1〜2室、一室最大2人です。無料取消期限と想定料金は表示だけで、予約状態を変えません。個人情報、決済、実ホテル、メール、外部予約、実際の取消は扱いません。

```bash
npm ci
npm run build:web
npm run validate:hotel
```

The shared build produces `dist/client/**` for Vercel, Netlify, and Render configuration checks, `dist/server/index.js` for the Cloudflare-compatible Sites package, and `dist/.openai/hosting.json` for the owning Site. The page registers exactly these four WebMCP capabilities:

- `check_existing_hotel_booking`
- `prepare_hotel_booking`
- `get_hotel_booking_status`
- `preview_hotel_cancellation`

Confirmation, payment, and cancellation mutation are deliberately absent. IndexedDB unique constraints, UUIDv7 events, and a SHA-256 forward chain protect the local result across repeated clicks, two tabs, reload, and retry. ChatGPT Sites and Vercel do not share browser storage, so the page explicitly says the fictional result belongs only to this device and deployment.

Local evidence currently passes 135 Node tests, TypeScript checking, four-tool discovery and execution in the in-app browser, a WebMCP preparation that enables the separate human confirmation button, arbitrary-input reload restoration, production-build offline reload, and 320/375/390/768-pixel overflow checks. The booking test also counts the physical IndexedDB booking rows and finds exactly one.

Public ChatGPT Sites version 8 uses exact source commit `370c2d9fb0b1a1a4938bbb0ba2c50b38d30a93d6` in deployment `appgdep_6a928039357c8191947ea3a0115e91a7` at the existing [public URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site). A fresh browser-storage run on version 8 reached `PREPARED → COMMITTED → RETRY_RECOGNIZED` with two attempts, one booking, one effect start, and the same result after reload. The anonymous [Vercel hotel demo](https://kyoto-booking-retry-proof.vercel.app) independently uses the same source commit in deployment `dpl_5pmmidN9UqT7ofDQrGgMPQ4umspN`: it returned HTTP 200, five delivered files matched the local release, and its own fresh browser-storage run produced the same retry-safe result.

One deployment operation mistakenly targeted the legacy notification project. Its production alias was immediately restored to deployment `dpl_3KTHTtZ5h8quDhviMTRo5GxBuUuE`; the anonymous URL returned HTTP 200 and showed the notification demo again.

A locally verified 150-second 1920×1080 review video version 10 combines 20 disclosed seconds of fictional generated dramatization with 113.2 seconds (75.5%) of actual public Site screen recording, then shows current public Sites version 7 service-state and retry-result captures. It preserves audible English narration, burned-in English captions, and a separate Japanese subtitle file. The [public Devpost project page](https://devpost.com/software/project-y79pb23hj1mz) contains the current explanation and live links and returns HTTP 200 without sign-in; its name remains `未定`, its video URL is empty, and `submitted_at` is `null`, so final hackathon submission has not occurred. Keyboard traversal, screen-reader behavior, Chrome-native WebMCP execution, video publication, and final Devpost submission remain `INCONCLUSIVE` or not started until their separate checks and approvals are recorded. See [`metadata/hotel-booking-verification.json`](metadata/hotel-booking-verification.json), [`metadata/vercel-hotel-deployment.json`](metadata/vercel-hotel-deployment.json), [`metadata/demo-video-production.json`](metadata/demo-video-production.json), and [`docs/23-hotel-booking-demo.ja.md`](docs/23-hotel-booking-demo.ja.md).

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
