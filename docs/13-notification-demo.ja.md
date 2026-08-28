---
title: "二重送信しないMac通知デモ"
language: "ja"
stable_uuid_v5: "4e376b00-450f-5799-a588-a7e3b0c41dd9"
event_uuid_v7: "01a04867-0d48-7c05-8809-02be217e0c5a"
updated_event_uuid_v7: "01a04896-44e0-7a6f-b602-573ad92db371"
generated_at: "2026-08-28T12:23:50Z"
updated_at: "2026-08-28T13:36:42.720Z"
version: "0.2.0"
status: "live-verified"
---

# 二重送信しないMac通知デモ

## 目的

通信切断、応答消失、処理再起動、同一要求の再試行があっても、同じ論理操作の通知を二度表示しないためのローカル参照実装です。模擬故障試験に加え、利用者の直前承認後にこのMacで実通知1件を表示し、同じ操作の再試行後も外部効果開始が1件のままであることを確認しました。

English purpose: Prevent a second visible notification for the same logical operation across retry, lost responses, and process restarts.

## 責任境界

| 部分 | 責任 |
|---|---|
| `NotificationEngine` | 入力正規化、UUIDバージョン5の予定識別子、承認検査、状態遷移 |
| `NotificationStore` | SQLiteの予定・試行・効果の三表、一意制約、直列化した実行権取得 |
| `AuditLog` | UUIDバージョン7の出来事とSHA-256ハッシュ連鎖JSON Lines |
| 通知アダプター | `preview`、`execute`、`reconcile`だけを公開 |
| ブラウザー試験ページ | 通知権限要求、通知タグへの予定識別子設定、表示結果の読み戻し |

制御状態と外部効果状態は分離します。

```text
DISCOVERED -> PROPOSED -> DRY_RUN -> USER_APPROVED -> EXECUTING -> VERIFIED
                    |             |                 |-> ABORTED
                    |             |-> REJECTED

NOT_STARTED -> AMBIGUOUS -> RECONCILING -> CONFIRMED_PRESENT
                                      |-> CONFIRMED_ABSENT
```

機械契約: `AMBIGUOUS`では再送を禁止し、`reconcile`だけを許可します。`CONFIRMED_ABSENT`の読み戻し後に限り、新しい承認を伴う再試行へ戻せます。

## 実行方法

```bash
uv sync --frozen
cd src/typescript && npm ci && cd ../..
make validate
make benchmark-notification
make demo
```

`http://127.0.0.1:4173`を開きます。「乾式実行」で内容と対象を確認した後、「承認して1回通知」を押すまで外部効果は起きません。通知後に「同じ操作を再試行」を押しても二件目は作られません。

## 実装済みの異常系

- 成功後の同一操作再試行
- 実行前失敗と`CONFIRMED_ABSENT`後の新しい承認
- 外部効果後の応答消失と`AMBIGUOUS`
- `AMBIGUOUS`中の再送拒否と読み戻し照合
- SQLiteを閉じて開き直した後の状態保持
- 承認期限切れ時の実行前停止
- 正常な模擬通知100回の承認後から結果までの95百分位測定

2026-08-28のこのMac上の模擬実行では、100標本の95百分位は`8.99 ms`で、上限`2,000 ms`を満たしました。環境と全標本は[`metadata/notification-demo-latency.json`](../metadata/notification-demo-latency.json)と[`data/timeseries/notification-demo-latency.ndjson`](../data/timeseries/notification-demo-latency.ndjson)に保存しています。これはブラウザー実通知の遅延ではありません。

## 実Mac通知の検証証拠

2026-08-28にGoogle Chrome `152.0.7977.64`から、UUIDバージョン5予定識別子`03c9c953-71ea-5405-b1eb-3c0536e78ec1`を通知タグとして1件表示しました。サービスワーカーの読み戻し件数は1、SQLiteの外部効果開始件数は1でした。同じ論理操作の再試行は`ALREADY_VERIFIED`となり、二件目を開始しませんでした。最終状態は`VERIFIED / CONFIRMED_PRESENT`、6件のJSON Lines監査ハッシュ鎖は有効です。

公開証拠は[`metadata/notification-demo-live-verification.json`](../metadata/notification-demo-live-verification.json)と[`data/audit/notification-demo-live-events.ndjson`](../data/audit/notification-demo-live-events.ndjson)です。外部サービス費用は0円です。この証拠はローカル観測とサービスワーカー読み戻しであり、遠隔証明ではありません。

## 残る未確認

- `document.modelContext`を提供するブラウザーでのネイティブWebMCP動作: `INCONCLUSIVE`
- Node.js 24の`node:sqlite`は公式文書上、安定化前の公開候補段階

根拠は[WHATWG Notifications API](https://notifications.spec.whatwg.org/)、[Node.js 24 SQLite](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html)、[SQLite Transaction](https://www.sqlite.org/lang_transaction.html)、[WebMCP Community Group草案](https://webmachinelearning.github.io/webmcp/)です。
