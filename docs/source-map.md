---
title: "Primary Source Map / 一次情報源対応表"
language: "ja-en"
stable_uuid_v5: "996e5fcf-8ad6-55db-874d-48ea873e5cf8"
event_uuid_v7: "01a04291-b473-7b9f-8aa2-eb9ac997adc5"
slo_gate_event_uuid_v7: "01a049a3-edbc-7d99-96f5-6bc46cd41163"
generated_at: "2026-08-27T09:34:00Z"
updated_at: "2026-08-28T18:31:15.132Z"
version: "0.1.0"
status: "design-specification"
---

# Primary Source Map / 一次情報源対応表

> **マジで大事 / Seriously important:** This repository stores links, metadata, and paraphrases—not copied standards or papers. Each source keeps its own terms.

Each source record also exists in [`knowledge/sources.json`](../knowledge/sources.json).

## Kyoto Booking Retry Proof evidence map / 京都ホテル再送の証拠対応表

<!-- event_uuid_v7=01a0538a-86ff-7649-893a-19400c01cee9 occurred_at=2026-08-30T16:39:42.591Z state_transition=SOURCE_MAP_BASELINE -> HOTEL_EVIDENCE_MAP_ADDED -->

Start with the existing [60-second judge path / 60秒手順](../examples/hotel-booking-demo/README.md#60-second-judge-path). / 最初に既存の60秒手順を読みます。

It lists the four safe tools—`check_existing_hotel_booking`, `prepare_hotel_booking`, `get_hotel_booking_status`, and `preview_hotel_cancellation`—and says only the visible human button confirms; retry ends at `RETRY_RECOGNIZED`. / 4つの安全な機能を確認し、確定は画面の人だけが行い、再試行後に`RETRY_RECOGNIZED`を見ます。

The four pairs below point both ways in the ledgers. Hotel evidence is related evidence, not a replacement for the general test. / 次の4組は台帳を双方向に結びます。ホテル証拠は関連証拠であり、一般試験の代わりではありません。

Common provenance / 共通の出所: this document uses repository base `5583cdbeddbbeae2c6f16fd481fc809069a15296`. The [hotel verification record](../metadata/hotel-booking-verification.json) uses source `f832cc611ed43613035a8735ca97d4bc1a0a8efc`, observed `2026-08-29T13:52:59.000Z`, Sites version 12, and [this Sites URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site). The [native reconciliation record](../metadata/hotel-native-webmcp-reconciliation.json) and [public release readback](../metadata/hotel-public-release-readback.json) use source `c8be388d8047472ef7d6ad69656255adb5903e37`; observations are `2026-08-30T13:53:37.248Z` and `2026-08-30T13:56:24.118Z` at [Vercel](https://kyoto-booking-retry-proof.vercel.app/) and its [evaluation file](https://kyoto-booking-retry-proof.vercel.app/webmcp-evals.json). The `c8be...` observation is not rewritten as a `5583...` execution. / この文書の基準は`5583...`です。SitesとVercelの記録は、それぞれ元の時刻とsourceを保ちます。

The ledgers are [`knowledge/requirements.json`](../knowledge/requirements.json) and [`knowledge/tests.json`](../knowledge/tests.json); the catalog is [`metadata/file-catalog.json`](../metadata/file-catalog.json). Source basis is the existing [SRC-WEBMCP-2026](#src-webmcp-2026), [SRC-TLA-LAMPORT](#src-tla-lamport), [SRC-PROVO-2013](#src-provo-2013), and [SRC-DCAT3-2024](#src-dcat3-2024) records, plus the official [Open Knowledge Format specification](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md) and [Knowledge Catalog OKF specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/HEAD/okf/SPEC.md). No authentication, broad WebMCP conformance, or Open Knowledge Format conformance claim is added. / 認証や広い適合を新しく主張しません。

| Read order / 読む順番 | General requirement / 一般要件 | General test / 一般試験 | Hotel evidence / ホテル証拠 | Status / 状態 | Time and version / 時刻と版 |
|---|---|---|---|---|---|
| 1. Read status first / 先に状態を読む | `REQ-EXEC-002`<br>不明な結果から変更操作へ直接再送しない / Do not retry a change directly from an unknown result. | `TEST-MODEL-002`<br>一般の有限状態モデル試験 / General finite-state model test. | Native reconciliation: status read found `COMMITTED`, then retry reached `RETRY_RECOGNIZED`; human confirmation only. | `PASS` in the native record. | `2026-08-30` / Vercel |
| 2. Keep one effect / 効果を一回にする | `REQ-EXEC-003`<br>同じ意思の効果は高々1回 / The same intent starts an effect at most once. | `TEST-MODEL-003`<br>一般の有限状態モデル試験 / General finite-state model test. | `311a96f7-7859-5b7f-baf2-17e39b83502d`: 2 attempts → 1 booking. | `PASS` | `2026-08-29` / Sites v12 |
| 3. Read back / 読み戻す | `REQ-TOOL-003`<br>書き込みの結果は読み戻して確かめる / Check a write result by reading it back. | `TEST-VERIFY-001`<br>一般の通知デモ向け試験 / General notification-demo test. | `6f65cf02-40eb-51c3-bdbc-4d532082fe0e`: Google Chrome page and WebMCP runtime. Native reconciliation separately records the read-before-retry flow. | Hotel verification: `INCONCLUSIVE`.<br>Native record: `PASS`. | `2026-08-29` / Sites v12; `2026-08-30` / Vercel |
| 4. Separate claim and observation / 主張と観測を分ける | `REQ-AUDIT-010`<br>記録された主張と独立した観測を分ける / Separate a recorded claim from an independent observation. | `TEST-VERIFY-003`<br>一般の証拠分離試験 / General claim-versus-observation test. | `e72277c5-f851-57da-a456-bfffc43f9479`: ChatGPT Sites live execution. | `PASS` (related hotel evidence). | `2026-08-29` / Sites v12 |

The three hotel-verification `INCONCLUSIVE` states remain so: Chrome/WebMCP runtime, keyboard focus, and screen-reader announcement. Local-video-to-public-video identity remains `UNMEASURED` in [`metadata/demo-video-production.json`](../metadata/demo-video-production.json). / ホテル確認の3件の`INCONCLUSIVE`と、動画同一性の`UNMEASURED`はそのままです。

## SRC-OPENAI-RESPONSES-CREATE-2026

- **Title:** OpenAI Responses API Create Response reference
- **Publisher:** OpenAI
- **Publication:** Living documentation; observed 2026-08-28
- **Status:** Official API reference
- **URL:** https://developers.openai.com/api/reference/cli/resources/responses/methods/create
- **UUIDv5:** `15ddbe8e-247d-57f3-bf21-3cba7a26c517`
- **UUIDv7:** `01a04948-c161-7234-8dc0-8db2fd23a98d`
- **Supports:** REQ-PLAN-001, REQ-PLAN-002, REQ-PLAN-003
- **Topics:** Responses API, tool choice, parallel tool calls, storage, output token limit, usage

## SRC-OPENAI-FUNCTION-CALLING-2026

- **Title:** OpenAI Function Calling guide
- **Publisher:** OpenAI
- **Publication:** Living documentation; observed 2026-08-28
- **Status:** Official developer guide
- **URL:** https://developers.openai.com/api/docs/guides/function-calling
- **UUIDv5:** `d7b737e5-ff59-53b9-b964-15eb58981fc5`
- **UUIDv7:** `01a04948-c162-7f71-b2fa-8df79f106838`
- **Supports:** REQ-PLAN-002, REQ-PLAN-003, REQ-TOOL-001
- **Topics:** function calling, strict mode, allowed tools, parallel tool calls, call identifiers

## SRC-WEBMCP-2026

- **Title:** WebMCP — Draft Community Group Report
- **Publisher:** W3C Web Machine Learning Community Group
- **Publication:** 2026-08-26
- **Status:** Draft Community Group Report; not a W3C Standard
- **URL:** https://webmachinelearning.github.io/webmcp/
- **UUIDv5:** `5512b64a-cffd-55db-a665-97f06b0754b3`
- **UUIDv7:** `01a04291-b340-79a1-ab18-e18e2715a156`
- **Supports:** CLM-001, CLM-002, CLM-003, CLM-020, REQ-WEBMCP-001, REQ-SEC-008
- **Topics:** WebMCP, tool registration, tool execution, tool annotations, security, prompt injection

## SRC-OPENAI-RESPONSES-2025

- **Title:** New tools for building agents
- **Publisher:** OpenAI
- **Publication:** 2025-03-11
- **Status:** Official product announcement
- **URL:** https://openai.com/index/new-tools-for-building-agents/
- **UUIDv5:** `cc769e2e-dd5a-5e6c-9846-a6e255180914`
- **UUIDv7:** `01a04291-b341-7d24-90d7-837e775a15a3`
- **Supports:** CLM-004, REQ-PLAN-001
- **Topics:** Responses API, built-in tools, agent orchestration

## SRC-OPENAI-MCP-2025

- **Title:** New tools and features in the Responses API
- **Publisher:** OpenAI
- **Publication:** 2025-05-21
- **Status:** Official product announcement
- **URL:** https://openai.com/index/new-tools-and-features-in-the-responses-api/
- **UUIDv5:** `c3559101-59f2-508b-9f90-f095310c8865`
- **UUIDv7:** `01a04291-b342-7b48-9ad3-6ca6d9475561`
- **Supports:** CLM-005, REQ-PLAN-002
- **Topics:** Responses API, remote MCP, tool calling

## SRC-OPENAI-RUNTIME-2026

- **Title:** From model to agent: Equipping the Responses API with a computer environment
- **Publisher:** OpenAI
- **Publication:** 2026-03-11
- **Status:** Official engineering article
- **URL:** https://openai.com/index/equip-responses-api-computer-environment/
- **UUIDv5:** `695b8f5a-ed77-5c3c-b9a7-7d8573f622c5`
- **UUIDv7:** `01a04291-b343-72e2-b58e-b8723e7f9b6d`
- **Supports:** CLM-006, REQ-PLAN-003, ADR-002
- **Topics:** agent loop, model proposal, runtime execution, isolated environment

## SRC-MCP-2026

- **Title:** Model Context Protocol Specification — 2026-07-28
- **Publisher:** Model Context Protocol Project
- **Publication:** 2026-07-28
- **Status:** Official protocol specification
- **URL:** https://modelcontextprotocol.io/specification/2026-07-28
- **UUIDv5:** `0040f552-6e8a-555a-8d77-ff88cf190932`
- **UUIDv7:** `01a04291-b344-79ab-9484-041f613ef2b2`
- **Supports:** CLM-007, REQ-MCP-001, REQ-SEC-004
- **Topics:** MCP, tools, authorization, host policy

## SRC-JSONLD-2020

- **Title:** JSON-LD 1.1 — A JSON-based Serialization for Linked Data
- **Publisher:** W3C
- **Publication:** 2020-07-16
- **Status:** W3C Recommendation
- **URL:** https://www.w3.org/TR/json-ld11/
- **UUIDv5:** `6ea7c25d-7b9e-50b9-9b59-127cd124d5b7`
- **UUIDv7:** `01a04291-b345-73b3-ace6-8d3927af50b2`
- **Supports:** CLM-008, REQ-KNOW-001
- **Topics:** JSON-LD, Linked Data, machine-readable graph

## SRC-PROVO-2013

- **Title:** PROV-O: The PROV Ontology
- **Publisher:** W3C
- **Publication:** 2013-04-30
- **Status:** W3C Recommendation
- **URL:** https://www.w3.org/TR/prov-o/
- **UUIDv5:** `a6ebf827-b311-50da-be6e-c0bbe61838f5`
- **UUIDv7:** `01a04291-b346-7331-b4e8-5e09bc780954`
- **Supports:** CLM-009, REQ-KNOW-002, REQ-AUDIT-010
- **Topics:** provenance, entities, activities, agents

## SRC-DCAT3-2024

- **Title:** Data Catalog Vocabulary (DCAT) — Version 3
- **Publisher:** W3C
- **Publication:** 2024-08-22
- **Status:** W3C Recommendation
- **URL:** https://www.w3.org/TR/vocab-dcat-3/
- **UUIDv5:** `7c4e7328-dbfe-55a6-8365-8783fc8f55c1`
- **UUIDv7:** `01a04291-b347-7a79-b861-6b258e6b9507`
- **Supports:** CLM-010, REQ-KNOW-003
- **Topics:** data catalog, datasets, distributions, checksums, versioning

## SRC-JSONSCHEMA-2020-12

- **Title:** JSON Schema: A Media Type for Describing JSON Documents
- **Publisher:** JSON Schema / IETF Internet-Draft archive
- **Publication:** 2022-06-16
- **Status:** JSON Schema Draft 2020-12 core specification
- **URL:** https://json-schema.org/draft/2020-12/json-schema-core.html
- **UUIDv5:** `d0bc2765-2f7b-534d-a88e-09d1a42cc364`
- **UUIDv7:** `01a04291-b348-7740-9d11-bbbd00c96e96`
- **Supports:** CLM-011, REQ-DATA-001, REQ-TOOL-001
- **Topics:** JSON Schema, validation, machine-readable contracts

## SRC-RFC8259

- **Title:** RFC 8259 — The JavaScript Object Notation (JSON) Data Interchange Format
- **Publisher:** IETF / RFC Editor
- **Publication:** 2017-12
- **Status:** Internet Standard
- **URL:** https://www.rfc-editor.org/info/rfc8259/
- **UUIDv5:** `2206143d-75e7-5f56-9fd3-7740940f85dc`
- **UUIDv7:** `01a04291-b349-71d0-b336-27a2ff871858`
- **Supports:** REQ-DATA-002
- **Topics:** JSON

## SRC-RFC7493

- **Title:** RFC 7493 — The I-JSON Message Format
- **Publisher:** IETF / RFC Editor
- **Publication:** 2015-03
- **Status:** Proposed Standard
- **URL:** https://www.rfc-editor.org/info/rfc7493/
- **UUIDv5:** `e17022d8-a733-5fa9-a23b-e6d4ba08b9ec`
- **UUIDv7:** `01a04291-b34a-73ba-ae4c-eded234796e2`
- **Supports:** REQ-DATA-003, REQ-TIME-002
- **Topics:** I-JSON, interoperability, timestamps

## SRC-RFC8785

- **Title:** RFC 8785 — JSON Canonicalization Scheme (JCS)
- **Publisher:** RFC Editor
- **Publication:** 2020-06
- **Status:** Informational RFC
- **URL:** https://www.rfc-editor.org/info/rfc8785/
- **UUIDv5:** `2f53445e-1dbd-5f35-954c-69af5e93690e`
- **UUIDv7:** `01a04291-b34b-7e17-9a69-fdd64d342d30`
- **Supports:** CLM-012, REQ-AUDIT-001
- **Topics:** canonical JSON, hashable representation, cryptography

## SRC-RFC9562

- **Title:** RFC 9562 — Universally Unique IDentifiers (UUIDs)
- **Publisher:** IETF / RFC Editor
- **Publication:** 2024-05
- **Status:** Proposed Standard; obsoletes RFC 4122
- **URL:** https://www.rfc-editor.org/info/rfc9562/
- **UUIDv5:** `dc6a4a7e-d313-5725-8bf7-ef3001781a2e`
- **UUIDv7:** `01a04291-b34c-7b8a-9af9-692ebcbc65fc`
- **Supports:** CLM-013, CLM-014, REQ-ID-001, REQ-ID-002
- **Topics:** UUIDv5, UUIDv7, identifier design

## SRC-RFC3339

- **Title:** RFC 3339 — Date and Time on the Internet: Timestamps
- **Publisher:** IETF / RFC Editor
- **Publication:** 2002-07
- **Status:** Standards Track RFC
- **URL:** https://www.rfc-editor.org/info/rfc3339/
- **UUIDv5:** `b50a5b84-01d7-5eed-9304-bb8de74d36fd`
- **UUIDv7:** `01a04291-b34d-7528-b02f-71fb20841f3d`
- **Supports:** CLM-015, REQ-TIME-001
- **Topics:** timestamps, UTC, ordering

## SRC-FIPS180-4

- **Title:** FIPS PUB 180-4 — Secure Hash Standard (SHS)
- **Publisher:** NIST
- **Publication:** 2015-08
- **Status:** Federal Information Processing Standard
- **URL:** https://csrc.nist.gov/pubs/fips/180-4/upd1/final
- **UUIDv5:** `60f7c6da-80a1-59d2-98fb-39c76bd555de`
- **UUIDv7:** `01a04291-b34e-7cca-8348-3af9ef27f517`
- **Supports:** REQ-AUDIT-002
- **Topics:** SHA-256, hash functions

## SRC-RFC8032

- **Title:** RFC 8032 — Edwards-Curve Digital Signature Algorithm (EdDSA)
- **Publisher:** RFC Editor
- **Publication:** 2017-01
- **Status:** Informational RFC
- **URL:** https://www.rfc-editor.org/info/rfc8032/
- **UUIDv5:** `2791987b-30bb-5a18-93c8-58f8c88aee80`
- **UUIDv7:** `01a04291-b34f-7e7e-961a-10fb8cea5ba0`
- **Supports:** CLM-016, REQ-AUDIT-003
- **Topics:** Ed25519, digital signatures

## SRC-RFC9162

- **Title:** RFC 9162 — Certificate Transparency Version 2.0
- **Publisher:** IETF / RFC Editor
- **Publication:** 2021-12
- **Status:** Proposed Standard
- **URL:** https://www.rfc-editor.org/info/rfc9162/
- **UUIDv5:** `aa6e88e6-e003-5321-a9ea-689c5e330000`
- **UUIDv7:** `01a04291-b350-7997-a5ee-6b92deb71073`
- **Supports:** CLM-017, REQ-AUDIT-004, REQ-AUDIT-005
- **Topics:** Merkle tree, inclusion proof, consistency proof

## SRC-TLA-LAMPORT

- **Title:** Specifying Systems and Verifying Specifications
- **Publisher:** Leslie Lamport / Microsoft Research
- **Publication:** 2002
- **Status:** Primary author publication
- **URL:** https://lamport.azurewebsites.net/pubs/spec-and-verifying.pdf
- **UUIDv5:** `f5c97a48-75c1-5e0f-82e6-c989fdc2ea7d`
- **UUIDv7:** `01a04291-b351-7a43-9e6b-9bc0696a9015`
- **Supports:** CLM-018, REQ-FORMAL-001, REQ-FORMAL-002
- **Topics:** TLA+, Init, Next, invariants, liveness

## SRC-POMDP-1998

- **Title:** Planning and Acting in Partially Observable Stochastic Domains
- **Publisher:** Artificial Intelligence
- **Publication:** 1998
- **Status:** Peer-reviewed research paper
- **URL:** https://www.cassandra.org/arc/papers/aij98.pdf
- **UUIDv5:** `52606e63-c0da-5134-b5c7-a8d4425ce4c2`
- **UUIDv7:** `01a04291-b352-7ebd-8b81-a4928f375e0d`
- **Supports:** CLM-019, F-002, F-016
- **Topics:** POMDP, belief state, planning

## SRC-CMDP-1999

- **Title:** Constrained Markov Decision Processes
- **Publisher:** CRC Press / INRIA author copy
- **Publication:** 1999
- **Status:** Research monograph / author copy
- **URL:** https://www-sop.inria.fr/members/Eitan.Altman/PAPERS/h.pdf
- **UUIDv5:** `1dbda155-9584-5df2-bead-cd6aa3279b18`
- **UUIDv7:** `01a04291-b353-79df-a9da-a2dc0fe953fd`
- **Supports:** CLM-021, F-028, F-607
- **Topics:** CMDP, constraints, occupancy measures

## SRC-CRDT-2011

- **Title:** Conflict-Free Replicated Data Types
- **Publisher:** SSS 2011 / Inria HAL
- **Publication:** 2011
- **Status:** Peer-reviewed research paper / open repository copy
- **URL:** https://hal.inria.fr/hal-00932836/document
- **UUIDv5:** `46666d42-bcff-5bb9-82cc-0fb4f1f9adc4`
- **UUIDv7:** `01a04291-b354-7a6d-8a90-86c4c3b1801c`
- **Supports:** CLM-022, F-023, REQ-SYNC-003
- **Topics:** CRDT, convergence, commutative merge

## SRC-LITTLE-1961

- **Title:** A Proof for the Queuing Formula: L = λW
- **Publisher:** Operations Research
- **Publication:** 1961-06-01
- **Status:** Peer-reviewed original paper
- **URL:** https://pubsonline.informs.org/doi/10.1287/opre.9.3.383
- **UUIDv5:** `fcb67262-133c-58c1-89b0-b2630ce06ad7`
- **UUIDv7:** `01a04291-b355-7b3e-a255-def914f71aa0`
- **Supports:** CLM-023, F-022, REQ-SYNC-006
- **Topics:** queueing, Little's Law

## SRC-CHOW-1970

- **Title:** On Optimum Recognition Error and Reject Tradeoff
- **Publisher:** IEEE Transactions on Information Theory / IBM Research
- **Publication:** 1970
- **Status:** Peer-reviewed original paper
- **URL:** https://research.ibm.com/publications/on-optimum-recognition-error-and-reject-tradeoff
- **UUIDv5:** `0c619fd4-b636-5983-8e75-2a63d7688c45`
- **UUIDv7:** `01a04291-b356-7004-94cf-eb2251e32346`
- **Supports:** CLM-024, F-026, REQ-POLICY-009
- **Topics:** reject option, abstention, classification risk

## SRC-GUO-2017

- **Title:** On Calibration of Modern Neural Networks
- **Publisher:** Proceedings of Machine Learning Research / ICML
- **Publication:** 2017
- **Status:** Peer-reviewed ICML paper / author preprint
- **URL:** https://arxiv.org/abs/1706.04599
- **UUIDv5:** `32c34a80-cd1e-57e9-b125-6221b821548d`
- **UUIDv7:** `01a049a3-edbc-7d99-96f5-6bc46cd41163`
- **Supports:** REQ-VERIFY-002, TEST-SLO-003
- **Topics:** confidence calibration, validation data, expected calibration error, temperature scaling

## SRC-NOTIFICATIONS

- **Title:** Notifications API Standard
- **Publisher:** WHATWG
- **Status:** Living Standard
- **URL:** https://notifications.spec.whatwg.org/
- **UUIDv5:** `d98065fe-fe57-5619-b2e0-a85a62594ddd`
- **UUIDv7:** `01a0486e-e08c-7c9e-bb66-7bdbc9d71579`
- **Supports:** REQ-TOOL-003, REQ-VERIFY-001
- **Topics:** browser notifications, `showNotification`, `getNotifications`, notification tags

## SRC-NODE-SQLITE-24

- **Title:** Node.js 24 SQLite documentation
- **Publisher:** Node.js Project
- **Status:** Official runtime documentation; `node:sqlite` is release-candidate stability in Node.js 24
- **URL:** https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html
- **UUIDv5:** `d7bcffcc-011d-5604-a176-e3486b776cbf`
- **UUIDv7:** `01a0486e-e0c4-78f2-a7f0-892b337f158b`
- **Supports:** REQ-OFFLINE-002, REQ-EXEC-001
- **Topics:** Node.js, SQLite, DatabaseSync, local persistence

## SRC-SQLITE-TRANSACTIONS

- **Title:** SQLite Transaction
- **Publisher:** SQLite Project
- **Status:** Official living documentation
- **URL:** https://www.sqlite.org/lang_transaction.html
- **UUIDv5:** `08ba5fb1-1a7d-5728-9ea0-79ef48acbce6`
- **UUIDv7:** `01a0486e-e103-7a50-9e83-bd0e1bcb5b09`
- **Supports:** REQ-EXEC-001, REQ-EXEC-002, REQ-OFFLINE-002
- **Topics:** transactions, `BEGIN IMMEDIATE`, write serialization, write-ahead logging

## Claim-to-source matrix / 主張と出典の対応

| Claim | Evidence relation | Sources |
|---|---|---|
| CLM-001 | direct | SRC-WEBMCP-2026 |
| CLM-002 | direct | SRC-WEBMCP-2026 |
| CLM-003 | direct | SRC-WEBMCP-2026 |
| CLM-004 | direct | SRC-OPENAI-RESPONSES-2025 |
| CLM-005 | direct | SRC-OPENAI-MCP-2025, SRC-MCP-2026 |
| CLM-006 | direct | SRC-OPENAI-RUNTIME-2026 |
| CLM-007 | direct | SRC-MCP-2026 |
| CLM-008 | direct | SRC-JSONLD-2020 |
| CLM-009 | direct | SRC-PROVO-2013 |
| CLM-010 | direct | SRC-DCAT3-2024 |
| CLM-011 | direct | SRC-JSONSCHEMA-2020-12 |
| CLM-012 | direct | SRC-RFC8785, SRC-RFC8259, SRC-RFC7493 |
| CLM-013 | direct | SRC-RFC9562 |
| CLM-014 | direct | SRC-RFC9562, SRC-RFC3339 |
| CLM-015 | direct | SRC-RFC3339 |
| CLM-016 | direct | SRC-RFC8032 |
| CLM-017 | direct | SRC-RFC9162, SRC-FIPS180-4 |
| CLM-018 | direct | SRC-TLA-LAMPORT |
| CLM-019 | direct | SRC-POMDP-1998 |
| CLM-020 | direct | SRC-WEBMCP-2026 |
| CLM-021 | direct | SRC-CMDP-1999 |
| CLM-022 | direct | SRC-CRDT-2011 |
| CLM-023 | direct | SRC-LITTLE-1961 |
| CLM-024 | direct | SRC-CHOW-1970 |
| CLM-025 | design-inference | SRC-WEBMCP-2026, SRC-OPENAI-RUNTIME-2026, SRC-TLA-LAMPORT |
| CLM-026 | design-inference | SRC-TLA-LAMPORT, SRC-RFC9162 |
| CLM-027 | design-inference | SRC-PROVO-2013, SRC-RFC8785, SRC-RFC9162 |
