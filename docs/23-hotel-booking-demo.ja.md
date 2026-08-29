---
title: "訪日旅行者向け・ホテル二重予約防止デモ"
language: "ja"
information_uuid_v5: "f91481fd-f6f9-53e4-8b23-b97065177b32"
event_uuid_v7: "01a04c37-78fb-732c-800d-cef1a0257120"
observed_at: "2026-08-29T06:31:43.000Z"
status: "sites-vercel-and-devpost-page-live-final-video-verified"
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

## 画面に出る検証証拠

現行の一般公開画面には、端末内履歴から読む検証パネルがあります。同じ予約条件を表すUUIDv5、履歴件数、最新イベントのUUIDv7、SHA-256連鎖の先頭12文字と連鎖検査結果を表示します。ChatGPT Sites版7では、履歴4件、連鎖`Valid`、同じ確認番号の再読込復元を確認しました。この表示は端末内履歴の可視化であり、実在する外部予約の証明ではありません。

## 保存範囲

保存先はブラウザーのIndexedDBです。ChatGPT SitesとVercelは別の公開元なので、保存領域を共有しません。画面に「この端末・この公開先だけの架空予約」と表示します。サーバーデータベース、ファイル保管、OpenAI API鍵は使いません。

## 現在の検査結果

| 検査 | 結果 | 根拠 |
|---|---|---|
| 言語変更でも同じUUIDv5 | 成功 | Node試験 |
| 二つのタブ、連打、再読込、複数再送 | 成功 | 競合試験と任意条件のChrome実画面 |
| 2試行、予約ストア物理1行、1確認番号、処理開始1 | 成功 | Node試験とアプリ内ブラウザー |
| WebMCP四機能の発見と実行 | 成功（現行版） | 一般公開前の版3で発見と実行を確認。版7は同じ四機能を維持し、通常の再送との比較を追加 |
| 120秒の準備失効 | 成功 | 読み取りは期限切れを即時表示し、画面処理が`EXPIRED`イベントを一度だけ永続化 |
| 本番構築物の通信断後復元 | 成功 | 現行構築物を強制通信断中に再読込し、2試行、1予約、処理開始1を復元 |
| 320、375、390、768ピクセル | 成功 | 横はみ出しなし、操作部品44ピクセル以上 |
| キーボード移動 | 判断不能 | 操作基盤がTab移動を再現できず、物理キーボード確認が必要 |
| 読み上げ | 判断不能 | 構造は確認済み、VoiceOver実行は未記録 |
| ChatGPT Sites一般公開実行 | 成功（現行版） | [本番URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site)の版7を未ログインで表示。2試行、1予約、処理開始1、同じ確認番号、再読込復元を確認 |
| 可視証拠パネル | 成功（現行版） | 版7でUUIDv5、最新UUIDv7、履歴4件、SHA-256連鎖`Valid`を確認。版5の同じ機能を実画面録画 |
| Vercel一般公開実行 | 成功（現行版） | [ホテル専用URL](https://kyoto-booking-retry-proof.vercel.app)を匿名表示。人間だけの確定、2試行から予約1件・処理開始1回への収束、同じ確認番号、再読込復元、連鎖`Valid`、誤り・警告0件を確認 |

Sitesの機械可読正本は[`metadata/hotel-booking-verification.json`](../metadata/hotel-booking-verification.json)、Vercelの正本は[`metadata/vercel-hotel-deployment.json`](../metadata/vercel-hotel-deployment.json)です。二つの提供元の配置証拠を混ぜません。

## 公開、動画、Devpostの現在状態

- WebMCP比較画面とVercel状態表を含む確定コミット`34eaed29c397d383cff264a7b86a7ff72a28c083`は、ChatGPT Sites版7として一般公開済みです。未ログイン表示、人間確認境界、再送収束、再読込復元を実URLで確認しました。
- 同じ確定コミットは、ホテル専用Vercelプロジェクトにも一般公開済みです。五つの公開ファイルを読み戻して端末内構築物との一致を確認し、旧通知実演は別プロジェクトの元の配置へ戻して上書きしていません。
- 最終動画v10は150秒、1920×1080、英語音声あり、英語字幕焼き込み済みです。生成映像20秒には架空表示があり、実際の公開Site画面録画は113.2秒（75.5%）です。終盤には現在の一般公開Sites版7のサービス状態表と、`RETRY_RECOGNIZED`・試行2・予約1・処理開始1を示す再送結果キャプチャがあります。SHA-256は`3c2635029fe01f5a9f20b4effddd62a8d5c1edc28e1e90db443645dbe78c49e7`です。日本語字幕は別のSubRipファイルとして保持し、動画公開はまだ行っていません。
- Devpostの[一般プロジェクトページ](https://devpost.com/software/project-y79pb23hj1mz)へ現行説明と三つの公開URLを反映し、未ログイン200応答を確認しました。名称は`未定`、動画URLは空、WebMCP Challengeへの提出時刻も空です。最終提出は行っていません。

## 構築と検査

```bash
npm ci
npm run quality:check
npm run build:web
node scripts/validate_hotel_site.mjs
cd src/typescript && npm test && npm run typecheck
```

コード品質の役割は重ねていません。Oxlintはホテル用JavaScriptの誤り、Biomeは画面のHTMLとCSS、Oxfmtは今回から管理する少数ファイルの書式だけを検査します。`npm run lsp:oxlint`、`npm run lsp:oxfmt`、`npm run lsp:biome`で各コード解析サーバーを起動できます。既存ファイル全体の自動整形は行いません。

構築物は次へ分離されます。

- ChatGPT Sites: `dist/server/index.js`、`dist/client/**`、`dist/.openai/hosting.json`
- 静的公開: `dist/client/**`

既存の通知デモと過去の証拠は変更しません。
