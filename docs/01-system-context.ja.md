---
title: "システム文脈と責務境界"
language: "ja"
stable_uuid_v5: "6b747963-4063-5028-b7be-aa605c0f225a"
event_uuid_v7: "01a04291-b457-72a5-a254-fb765e03ece0"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# システム文脈と責務境界

## 1. ねらい

このシステムの目的は、スマホで回線が切れても中核業務を継続しつつ、オンライン時だけ高性能な推論を追加し、外部副作用を**数理的な許可・検証・証跡**の下で実行することです。

本質だけ言うと、**LLMに全部任せる設計は盛れて見えても、責任境界がゆるいと普通に事故る**。だから役割を切ります。

| 層 | 役割 | 権限 |
|---|---|---|
| User / Mandate | 目的、許容範囲、承認 | 権限の根 |
| Planner | 候補計画を提案 | 権限を生成しない |
| Tool Contract Engine | hard gate、効用、riskを評価 | 実行許否の決定権 |
| EFSM | 合法な状態遷移だけ許す | 遷移権威 |
| WebMCP Adapter | 構造化toolを発見・実行 | 許可済み操作のみ |
| Evidence Engine | 現実の効果を検証 | commit根拠を作る |
| Audit Log | 署名付き履歴を保持 | provenance |
| Sync Server | offline chainを検証・統合 | global ingestion order |
| Responses API | オンライン候補計画 | optional planner |

## 2. 信頼境界


tool/page出力、LLM出力、remote contentはすべて**提案またはデータ**です。そこから権限は増えません。

\[
Authority_{t+1}\subseteq Authority_t\cup ExplicitHumanGrant_t
\]

Critical commit toolはplannerへ公開せず、prepare/review toolだけ公開します。

## 3. データフロー

1. User intentを正規化し、UUIDv5で意味の同一性、UUIDv7で発生順序を与える。
2. local state、network、battery、tool registryを観測する。
3. feasible toolsだけを候補集合へ残す。
4. rule/local/Responses/humanからplannerを選ぶ。
5. Tool Contract Engineが `ALLOW / DENY / HUMAN / RECONCILE` を返す。
6. `ALLOW` のみWebMCP executionへ進む。
7. execution resultを独立証拠でread-backする。
8. EFSMが `VERIFIED` を経たものだけ `COMMITTED` にする。
9. 全イベントをcanonicalize→hash→chain→signする。
10. offline中は未実行intentをqueueし、復帰時に全条件を再検証する。

## 4. 外部仕様との関係

WebMCPはWebアプリがJavaScript toolを公開するdraftであり、本リポジトリではcapability/action substrateとしてadapter層に隔離します。 [SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

Responses APIはcandidate planningのonline optionです。tool executionとauthorizationはruntime/policy側に残します。 [SRC-OPENAI-RESPONSES-2025](source-map.md#src-openai-responses-2025) [SRC-OPENAI-RUNTIME-2026](source-map.md#src-openai-runtime-2026)
