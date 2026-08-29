---
title: "訪日旅行者向け・ホテル二重予約防止デモ"
language: "ja"
information_uuid_v5: "f91481fd-f6f9-53e4-8b23-b97065177b32"
event_uuid_v7: "01a04b5a-5d98-77bc-8c2f-db0cb564eb68"
observed_at: "2026-08-29T02:30:08.536Z"
status: "owner-only-live-verified"
---

# 訪日旅行者向け・ホテル二重予約防止デモ

## 一言でいうと

通信が切れて成功画面を受け取れなくても、同じ予約をもう一件作らず、最初の確認番号を取り戻す架空デモです。対象は`Fictional Kyoto Ryokan`の`Standard Flexible`だけです。実ホテル、個人情報、決済、メール、外部予約、実際の取消は扱いません。

<!-- information_uuid_v5=6ecef8ee-286c-5cf0-a6df-b67de6b774bc -->
<!-- event_uuid_v7=01a04bd0-b895-7093-97cf-ad532592a07f state_transition=EMPTY -> PREPARED -> HUMAN_APPROVED -> COMMITTED -> RETRY_RECOGNIZED occurred_at=2026-08-29T01:25:00Z -->
<!-- machine-contract=Only the visible human button can commit. WebMCP can check, prepare, read status, and preview cancellation terms; it cannot confirm, pay, or cancel. -->

## 画面で起こること

1. 宿泊日、大人人数、部屋数を検査します。
2. 準備状態を端末内へ保存します。承認は内容と料金に結び付き、120秒で失効します。
3. 人が画面の確認ボタンを押すと、架空予約を一件だけ保存します。
4. 成功応答だけを意図的に隠します。
5. 同じ内容を再送すると、既存の確認番号を返します。
6. 画面は`2 attempts → 1 simulated booking → 1 confirmation number`を表示します。

料金は一室一泊12,000円です。宿泊は1〜14泊、大人は1〜4人、部屋は1〜2室、一室最大2人です。取消プレビューの無料期限は、チェックイン日の日本時間15時から72時間前です。それ以降の想定料金は一室につき一泊分ですが、プレビューは予約状態を変えません。

## WebMCP境界

| 機能 | 読み書き | できること |
|---|---|---|
| `check_existing_hotel_booking` | 読み取り | 同じ条件の端末内予約があるか確認 |
| `prepare_hotel_booking` | 準備だけ | 入力、料金、取消条件を検査し120秒の準備を作成 |
| `get_hotel_booking_status` | 読み取り | 応答消失後も同じ状態と確認番号を復元 |
| `preview_hotel_cancellation` | 読み取り | 無料期限と想定料金を表示し、状態は変更しない |

予約確定、決済、取消のWebMCP機能は存在しません。確定処理を読み込むのは画面の人間向け実装だけで、WebMCPアダプターからは到達できません。

## 一件に収束する仕組み

- ホテル、プラン、日付、人数、部屋数を正規化し、固定名前空間のUUIDv5を予約識別子にします。
- 英語と日本語の表示選択は識別子から除外します。
- IndexedDBの予約条件と確認番号に一意制約を置きます。
- 人間承認と`COMMITTED`記録、架空予約一件、処理開始数`1`を一つの取引で保存します。
- 各状態変化へUUIDv7を付け、直前のSHA-256要約値を含む前方連鎖にします。
- 二回目以降の再送は`RETRY_RECOGNIZED`を読み取り、処理開始数を増やしません。
- 最後に扱った予約識別子を端末内へ残し、再読込時はその識別子から日付、人数、部屋数、表示言語を復元します。
- 期限到達は画面の時計、再読込、再準備のいずれでも`PREPARED → EXPIRED`として一度だけ記録され、予約処理は始まりません。

## 保存範囲

保存先はブラウザーのIndexedDBです。ChatGPT SitesとVercelは別の公開元なので、保存領域を共有しません。画面に「この端末・この公開先だけの架空予約」と表示します。サーバーデータベース、ファイル保管、OpenAI API鍵は使いません。

## 現在の検査結果

| 検査 | 結果 | 根拠 |
|---|---|---|
| 言語変更でも同じUUIDv5 | 成功 | Node試験 |
| 二つのタブ、連打、再読込、複数再送 | 成功 | 競合試験と任意条件のChrome実画面 |
| 2試行、予約ストア物理1行、1確認番号、処理開始1 | 成功 | Node試験とアプリ内ブラウザー |
| WebMCP四機能の発見と実行 | 成功 | 所有者限定のChatGPT Sites本番URL。準備後に人間確認ボタンが有効になることも確認 |
| 120秒の準備失効 | 成功 | 読み取りは期限切れを即時表示し、画面処理が`EXPIRED`イベントを一度だけ永続化 |
| 本番構築物の通信断後復元 | 成功 | 現行構築物を強制通信断中に再読込し、2試行、1予約、処理開始1を復元 |
| 320、375、390、768ピクセル | 成功 | 横はみ出しなし、操作部品44ピクセル以上 |
| キーボード移動 | 判断不能 | 操作基盤がTab移動を再現できず、物理キーボード確認が必要 |
| 読み上げ | 判断不能 | 構造は確認済み、VoiceOver実行は未記録 |
| ChatGPT Sites所有者限定実行 | 成功 | [本番URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site)で四機能、2試行、1予約、処理開始1、同じ確認番号、再読込復元を確認 |
| ChatGPT Sites一般公開、Vercel更新 | 未計測 | 別承認が必要 |

機械可読の正本は[`metadata/hotel-booking-verification.json`](../metadata/hotel-booking-verification.json)です。

## 構築と検査

```bash
npm ci
npm run build:web
node scripts/validate_hotel_site.mjs
cd src/typescript && npm test && npm run typecheck
```

構築物は次へ分離されます。

- ChatGPT Sites: `dist/server/index.js`、`dist/client/**`、`dist/.openai/hosting.json`
- 静的公開: `dist/client/**`

既存の通知デモと過去の証拠は変更しません。
