---
title: "二重送信しないMac通知デモ"
language: "ja"
stable_uuid_v5: "4e376b00-450f-5799-a588-a7e3b0c41dd9"
event_uuid_v7: "01a04867-0d48-7c05-8809-02be217e0c5a"
updated_event_uuid_v7: "01a048c2-e2ef-7332-9e24-8a995f68a859"
replay_verification_event_uuid_v7: "01a0497e-f947-7442-b95c-2eed7476e477"
replay_browser_event_uuid_v7: "01a04987-5d7c-7ebe-9208-c468f5c24ebf"
effect_accounting_event_uuid_v7: "01a0498b-5662-7094-9bef-88e9b2f13a10"
effect_start_semantics_event_uuid_v7: "01a04993-3867-7e11-b120-01b3bab8ec62"
generated_at: "2026-08-28T12:23:50Z"
updated_at: "2026-08-28T18:13:00.135Z"
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

機械契約: `AMBIGUOUS`では再送を禁止し、`reconcile`だけを許可します。「いま表示がない」だけでは過去に一度も表示されなかった証明にならないため、結果不明のまま止めます。実行前に開始していないことと現在の表示なしを別々に確認して`CONFIRMED_ABSENT`になった後も、自動では戻しません。権限条件、端末の許可、処理の版、利用者の同意、有効期限、表示なしの前提条件という6項目の新しい証拠がすべて合格した場合だけ、新しい承認を伴う再試行へ戻せます。

また、道具が返した結果は「記録された主張」にすぎません。成功確定には、通知アダプターの照合処理またはService Workerの`getNotifications()`による別経路の読み戻しが必要です。記録された主張と、読み戻しから求めた現実の推定はSQLite内でも別項目として保存します。

実行権を取得した回数と、外部効果を開始した、または開始した可能性がある回数も分けます。台帳の`STARTED`と`UNKNOWN`は安全側で各1回と数えます。明示的な実行前失敗と独立した表示なしの両方がそろった`NOT_STARTED`だけは0回です。その記録は監査用に残るため、後の安全な再試行が1回成功しても、保守的な外部効果開始件数は2ではなく1です。

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
- 再試行前6項目の各単独不成立と、6項目すべてが成立する場合
- 道具の自己申告だけでは成功確定しないこと
- Service Workerの読み戻しが0件、2件、別の予定識別子なら成功確定しないこと
- 記録された主張と独立した現実の推定を分けて保存すること

2026-08-28のこのMac上の模擬実行では、100標本の95百分位は`8.99 ms`で、上限`2,000 ms`を満たしました。環境と全標本は[`metadata/notification-demo-latency.json`](../metadata/notification-demo-latency.json)と[`data/timeseries/notification-demo-latency.ndjson`](../data/timeseries/notification-demo-latency.ndjson)に保存しています。これはブラウザー実通知の遅延ではありません。

## 二重送信防止の可視化

試験ページは、初回要求と同じ操作の再試行が一つの`Intent ID`台帳へ集まり、二件目だけが停止する流れを二本の経路で示します。件数は固定値ではなくSQLiteの外部効果開始台帳から読み、2以上なら成功表示へ丸めず安全条件違反を示します。さらに再試行前6項目を横一列で示し、実行済みなら「確認不要」、結果不明なら「照合が先」、表示なしなら「再確認待ち」と明示します。画面契約は[`14-notification-visualization.ja.md`](14-notification-visualization.ja.md)、今回の乾式実行証拠は[`metadata/replay-independent-verification.json`](../metadata/replay-independent-verification.json)にあります。この実装変更では新しい実通知を表示していません。

## 実Mac通知の検証証拠

2026-08-28にGoogle Chrome `152.0.7977.64`から、UUIDバージョン5予定識別子`03c9c953-71ea-5405-b1eb-3c0536e78ec1`を通知タグとして1件表示しました。サービスワーカーの読み戻し件数は1、SQLiteの外部効果開始件数は1でした。同じ論理操作の再試行は`ALREADY_VERIFIED`となり、二件目を開始しませんでした。最終状態は`VERIFIED / CONFIRMED_PRESENT`、6件のJSON Lines監査ハッシュ鎖は有効です。

公開証拠は[`metadata/notification-demo-live-verification.json`](../metadata/notification-demo-live-verification.json)と[`data/audit/notification-demo-live-events.ndjson`](../data/audit/notification-demo-live-events.ndjson)です。外部サービス費用は0円です。この証拠はローカル観測とサービスワーカー読み戻しであり、遠隔証明ではありません。また、この不変証拠は`0.2.0`時点の6件の監査記録です。現在の参照実装は独立照合の状態遷移を1件追加しており、その経路は模擬試験済みですが、新しい実通知は未実行です。

## 残る未確認

- Codex内蔵ブラウザーでは`document.modelContext`と`notify_once`登録を確認済み。対象ブラウザー全体の実行・権限・汚染対策を含むネイティブWebMCP適合: `INCONCLUSIVE`
- Node.js 24の`node:sqlite`は公式文書上、安定化前の公開候補段階

根拠は[WHATWG Notifications API](https://notifications.spec.whatwg.org/)、[Node.js 24 SQLite](https://nodejs.org/download/release/v24.16.0/docs/api/sqlite.html)、[SQLite Transaction](https://www.sqlite.org/lang_transaction.html)、[WebMCP Community Group草案](https://webmachinelearning.github.io/webmcp/)です。
