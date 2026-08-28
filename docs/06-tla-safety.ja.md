---
title: "TLA+安全仕様"
language: "ja"
stable_uuid_v5: "536e6c8c-7a09-5823-8663-288ecc477768"
event_uuid_v7: "01a04291-b461-777b-9d07-f50e2c2deb68"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# TLA+安全仕様

\[
Spec=Init\land\Box[Next]_{vars}
\]

検査対象:

- 未承認`EXECUTING`が到達不能
- `effectCount>1`が到達不能
- 未検証`COMMITTED`が到達不能
- `AMBIGUOUS→EXECUTING`が到達不能
- 正常`COMMITTED`は到達可能

[`formal/tla/ToolExecution.tla`](../formal/tla/ToolExecution.tla) が規範behavior specificationです。リポジトリ同梱のPython reachability checkerは同じ有限抽象モデルを独立探索し、mutation testで検査器が実際に事故を発見できることも確認します。

TLA+とTLCの考え方はLamportの一次資料に紐づけています。 [SRC-TLA-LAMPORT](source-map.md#src-tla-lamport)
