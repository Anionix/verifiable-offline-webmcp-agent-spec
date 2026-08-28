---
title: "実装計画"
language: "ja"
stable_uuid_v5: "4ec4eedc-aec2-504e-aa65-28959a72726c"
event_uuid_v7: "01a04291-b46d-7043-93ac-cc86b44a6161"
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

- Responses bridge。
- tool-set minimization。
- privacy budget、cost/latency routing。

## Phase 4 — sync/audit

- signed checkpoints、Merkle inclusion、fork detection。
- conflict workflow。

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
