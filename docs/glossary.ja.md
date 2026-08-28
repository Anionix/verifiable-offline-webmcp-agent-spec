---
title: "用語集"
language: "ja"
stable_uuid_v5: "7f3e96a2-8cbd-5042-b9c9-6446648a1d0f"
event_uuid_v7: "01a04291-b46f-78bb-a5fa-4ce805da8633"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# 用語集

| 用語 | 意味 |
|---|---|
| authority | 実行を合法化する権限。planner confidenceとは別物。 |
| belief | 部分観測から推定した世界状態の確率分布。 |
| commit | verification済み効果を正式な成功として確定すること。 |
| evidence | read-back、receipt、state diff等、効果を支持・反証する観測。 |
| hard gate | falseなら候補集合から操作を除外する条件。 |
| intent | tool、正規化引数、target、scope、amount、expiry等を束ねた実行意図。 |
| reconcile | external effectの有無を再観測して確定する処理。 |
| WebMCP | Webページが構造化toolをmodel clientへ公開するdraft API。 |
| Responses API | 本設計ではオンライン候補plannerとして使うAPI。 |
| UUIDv5 | namespace+nameから決定的に作る意味ID。 |
| UUIDv7 | Unix epoch millisecond順のevent ID。 |
| JCS | JSON canonicalization scheme。 |
| EFSM | 数値contextとguardを持つ有限状態機械。 |
