---
title: "エグゼクティブサマリー"
language: "ja"
stable_uuid_v5: "6fdb1b44-1914-548b-9f5e-5f06abf9fcef"
event_uuid_v7: "01a04291-b453-74f5-b272-38ce5f8acb11"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# エグゼクティブサマリー

## 5W1H

- **Who / 誰が:** ユーザー、ローカルplanner、Responses API、Policy Engine、WebMCP tool、Evidence Engine、監査service。
- **What / 何を:** ユーザー意図を安全に計画・実行・検証・同期・監査する。
- **When / いつ:** オンラインでもオフラインでも。特に回線断・timeout・再同期時。
- **Where / どこで:** スマホ内、browser/WebMCP、remote planner、同期server、外部checkpoint。
- **Why / なぜ:** LLMの文章的な「自信」では、権限・副作用・二重実行・事実確認を保証できないから。
- **How / どうやって:** hard gate、expected utility、EFSM、TLA+、独立証拠、署名event log、SLO最適化。

## 本質的なギャル要約

> **マジで大事:** AIが「やっといたよ♡」って言っても、現実に反映された証拠がなければ未完了。ノリでcommitしない。`SUCCEEDED != VERIFIED`。

1. WebMCPからtoolを発見する。
2. Tool Contractへ変換する。
3. hard gateで危ないtoolを消す。
4. Rules / Local / Responses / Humanからplannerを選ぶ。
5. plannerはcandidate planだけを返す。
6. Policy Engineがexact intentへauthorizationをbindする。
7. WebMCPが実行する。
8. timeout/UNKNOWNならretryせずreconcileする。
9. Evidence Engineがread-backやreceiptで確認する。
10. VERIFIEDだけCOMMITTEDへ進める。
11. 全eventをcanonicalize、hash、sign、checkpointする。
12. 実測dataでthreshold/retry/verify budgetを再最適化する。

## 非交渉条件

- 未承認実行は到達不能。
- 同一intentの外部economic effectは高々1回。
- AMBIGUOUSからmutation retryしない。
- COMMITTEDはVERIFIEDを必ず通る。
- LLM、tool output、web contentは権限を増やせない。
- offline queueは未実行intentであり、復帰時に必ず再検証する。

Primary sources: SRC-WEBMCP-2026, SRC-OPENAI-RUNTIME-2026, SRC-TLA-LAMPORT, SRC-RFC9562, SRC-RFC8785, SRC-RFC9162.
