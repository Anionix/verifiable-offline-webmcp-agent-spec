<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a0b-578f-7ab8-8be3-9ea9f2d7a6c6 state_transition=DISCOVERED -> REVIEW occurred_at=2026-08-28T20:24:12.431Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a11-70f3-7dd6-8a87-97401a43b74e state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T20:30:52.147Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a1b-eac6-7c5c-aa43-c19d4a593bfb state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T20:42:18.694Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a22-521a-7db8-b2a8-c73b4dbb589f state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T20:49:18.362Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a28-9e04-7709-9ce3-49b9331fd953 state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T20:56:11.012Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a2c-246b-7e0e-bc66-2a7ff653aef0 state_transition=REVIEW -> REVIEW occurred_at=2026-08-28T21:00:02.027Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a31-7c41-7387-8712-8bf4df61028d state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T21:05:52.193Z -->
<!-- information_uuid_v5=62165297-6dec-5f97-a77b-3eb1892678eb event_uuid_v7=01a04a3b-7a18-7745-9b09-d8e5a2a74866 state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:16:47.000Z -->
<!-- information_uuid_v5=3093ad26-25f3-5912-b015-70a04c93fe08 event_uuid_v7=01a04a3b-7a18-76a0-b150-b1aacc95e727 state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:16:47.000Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a41-680c-70f5-b9cd-25546a3ba4f2 state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T21:23:15.596Z -->
<!-- information_uuid_v5=6bf6cd1e-2220-5770-a630-6bb7eeb0c1ee event_uuid_v7=01a04a4c-1be8-7fcc-a67f-5eaff2cc8030 state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:34:57.000Z -->
<!-- information_uuid_v5=4cb035a8-f737-514f-90c6-da6c0672f814 event_uuid_v7=01a04a4c-1be8-727c-9b05-be91397708b3 state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:34:57.000Z -->
<!-- information_uuid_v5=22f6663a-2651-58fe-aab8-f213212c6562 event_uuid_v7=01a04a4c-1be8-7a58-a3c1-5c4e0474d59f state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:34:57.000Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a52-7dd3-7055-ac87-729f8708b6f0 state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T21:41:55.283Z -->
<!-- information_uuid_v5=d2cbf4dc-f6a8-53df-ae82-e3e84f51ee7f event_uuid_v7=01a04a5a-ece0-7715-a44c-3fe4200880af state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:51:08.000Z -->
<!-- information_uuid_v5=4eeca0e8-026c-559e-9496-885453aa6f30 event_uuid_v7=01a04a5a-ece0-7715-a44c-3fe4200880af state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:51:08.000Z -->
<!-- information_uuid_v5=c2e27d1a-220f-5c4a-b6f6-7075bf2c5733 event_uuid_v7=01a04a5a-ece0-7715-a44c-3fe4200880af state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:51:08.000Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a64-9fc9-7ef6-a637-aefbf6b1077f state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T22:01:43.625Z -->
<!-- information_uuid_v5=133e9b91-5738-5e1c-8bcd-567a65bba243 event_uuid_v7=01a04a5f-6d38-7fc8-89b3-1e7daabc661d state_transition=VERIFIED -> REVIEW occurred_at=2026-08-28T21:56:03.000Z -->
<!-- information_uuid_v5=639e8139-1107-51f4-9949-333119ddb0be event_uuid_v7=01a04a74-840d-7a37-9c02-acbe4413fec9 state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T22:19:05.101Z -->

# 不具合レビュー再照合

閉じたpull requestを横断して、未解決表示のレビュー14件を現行コードへ結び直した。その修正pull request #51で新たに17件の指摘を受け、すべて失敗試験、変異検査、実ブラウザー確認から修正した。合計31件のうち2件は既に直っており、29件はこの修正版で直した。今回の確認では通知権限要求、実通知、外部効果を行っていない。

```text
レビュー31件
├─ 過去レビュー 14件
│  ├─ 既に修正済み 2件
│  └─ 今回修正 12件
└─ pull request #51の追加レビュー 17件
   ├─ 永続状態、別Intent、WebMCP表示、同時呼び出し、実測件数 7件
   ├─ Schemaと秘密項目の境界 3件
   └─ 旧台帳、署名鎖、信頼鍵、各チェックポイント、取込判断、SQLite識別列 7件

残り 0件
```

機械確認用の正本は [`metadata/review-thread-reconciliation.json`](../metadata/review-thread-reconciliation.json)。各行に元レビュー、重要度、修正ファイル、回帰試験を記録している。

画面では同じ論理操作を二度乾式実行し、さらに異なる二操作を同時に乾式実行した。遅れて完了した操作の画面入力、通知予定識別子、SQLite保存内容はすべて一致した。永続状態は `DRY_RUN / NOT_STARTED`、通知開始は0回、通知許可要求は0回、画面エラーと外部通信は0件だった。実通知は行っていない。

## 完了条件

- 全31件に別々のUUIDバージョン5識別子がある。
- 修正ファイルと試験ファイルが存在する。
- Schema検査、111件のNode試験、型検査、全体検証が成功する。
- 公開mainと修正版タグから同じ証拠を読み戻す。
- 元レビューへ修正先を返信し、未解決表示を解消する。

境界: ネイティブWebMCP全面適合と本番品質は、この再照合からは結論を出さない。既存どおり `INCONCLUSIVE` と `UNMEASURED` を維持する。
