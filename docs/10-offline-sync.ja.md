---
title: "オフラインキューと同期"
language: "ja"
stable_uuid_v5: "f15b22f2-451d-5d7c-8edf-d6b590d63113"
event_uuid_v7: "01a04291-b469-7f58-a11e-95416ac22c99"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# オフラインキューと同期

queueに保存するのは**未実行intent**です。

\[
QUEUED\Rightarrow ExternalEffectStarted=0
\]

replay条件:

\[
Online\land NotExpired\land Auth\land Permission\land Version\land Consent\land Preconditions
\]

- CRDTは可換・結合的・冪等なデータだけに使う。
- payment、send、reservation、destructive mutationは自動mergeしない。
- deviceごとにsigned local chainを持ち、sync serverがglobal ingestion sequenceを付ける。
- wall clockではなくhash referenceでcausalityを表す。

CRDTの強収束条件: [SRC-CRDT-2011](source-map.md#src-crdt-2011)

queue観測にはLittle's Lawを使います。 [SRC-LITTLE-1961](source-map.md#src-little-1961)
