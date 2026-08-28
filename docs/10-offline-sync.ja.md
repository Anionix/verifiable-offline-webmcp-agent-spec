---
title: "オフラインキューと同期"
language: "ja"
stable_uuid_v5: "f15b22f2-451d-5d7c-8edf-d6b590d63113"
event_uuid_v7: "01a04291-b469-7f58-a11e-95416ac22c99"
updated_event_uuid_v7: "01a04927-4661-7ee3-8a17-5a90fc7400c0"
generated_at: "2026-08-27T09:34:00Z"
updated_at: "2026-08-28T16:15:05.985Z"
version: "0.4.0-candidate"
status: "reference-implementation"
---

# オフラインキューと同期

queueに保存するのは**未実行intent**です。`0.4.0`参照実装では、端末別の署名鎖とSQLite取込台帳を加えました。

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

実装済みの境界:

- 端末ごとのEd25519署名、連番、直前ハッシュ、Merkle root、署名済みチェックポイント
- 端末内連番を保った全体取込連番と、再取込時の同じ結果
- 署名改変、欠番、分岐、チェックポイント不一致の隔離
- 追加だけできるタグ集合の統合
- 通知等の外部効果を`HUMAN_REVIEW_REQUIRED`へ止め、同期役へ実行権限を渡さない

二端末の通し証拠、画面、未計測範囲は[二端末オフライン同期の参照実装](17-offline-sync-reference.ja.md)を参照してください。

CRDTの強収束条件: [SRC-CRDT-2011](source-map.md#src-crdt-2011)

queue観測にはLittle's Lawを使います。 [SRC-LITTLE-1961](source-map.md#src-little-1961)
