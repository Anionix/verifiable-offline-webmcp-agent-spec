---
title: "実装計画"
language: "ja"
stable_uuid_v5: "4ec4eedc-aec2-504e-aa65-28959a72726c"
event_uuid_v7: "01a04291-b46d-7043-93ac-cc86b44a6161"
online_planner_event_uuid_v7: "01a04948-c160-7c0b-8fec-f03319874dd2"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# 実装計画

## Phase 0 — 規範モデル

- Canonical IRとschemaをfreeze。
- golden vectorsをTypeScript/Wolframで一致。
- EFSM/TLA+ safety invariantをCIへ。

## Phase 1 — local/offline core

- intent capture、local DB、queue、read cache。
- deterministic rule engine。
- per-device event chain。

## Phase 2 — WebMCP adapter

- discovery、schema projection、execution wrapper。
- origin/permission/taint policy。
- read-back evidence。

## Phase 3 — online planning

- ローカル参照実装: 通信処理を注入するResponses境界と、実通信を行わない模擬計画器を実装済み。
- ローカル参照実装: 許可済み・実行可能・候補専用の道具だけへ最小化し、厳格な入力形を固定済み。
- ローカル参照実装: 公開情報の最小投影、秘密らしい値の検出、信頼済み料金表、最悪費用上限、待ち時間上限を実装済み。
- ローカル参照実装: 候補を未承認のまま隔離し、時間切れ・応答消失・不正返答で自動再試行しない故障試験を実装済み。
- 実Responses API通信、現在料金、本番品質は未実装、`UNMEASURED`、または`INCONCLUSIVE`。

## Phase 4 — sync/audit

- ローカル参照実装: signed checkpoints、端末別鎖、global ingestion sequence、fork detectionを実装済み。
- ローカル参照実装: 可換・冪等なタグ集合だけを統合し、外部効果を人の確認待ちへ隔離済み。
- 遠隔transport、実機二台、長期運用測定は未実装または`UNMEASURED`。

## Phase 5 — calibration

- tool reliability、verification ROC、SLO fitting。
- class別`θ/R/V/z` optimization。

## Definition of Done

- structured assets schema-valid
- TypeScript golden vectors pass
- Wolfram formulas reproduced
- reachability safety violations 0
- mutation tests detect intentional faults
- audit chain/signature/Merkle proof valid
- no private key included
