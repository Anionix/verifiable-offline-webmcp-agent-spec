---
title: "訪日旅行者向け・ホテル二重予約防止デモ"
language: "ja"
information_uuid_v5: "f91481fd-f6f9-53e4-8b23-b97065177b32"
event_uuid_v7: "01a04dcb-8678-79cc-97a7-5daac61059f8"
observed_at: "2026-08-29T13:52:59.000Z"
status: "sites-version-12-current-vercel-clean-current-carried-forward-browser-proof-youtube-public-artifact-identity-unmeasured-devpost-final-submission-provider-verified-title-image-current"
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

現行の一般公開先はChatGPT Sites版9です。画面には、端末内履歴から読む検証パネルがあり、同じ予約条件を表すUUIDv5、履歴件数、最新イベントのUUIDv7、SHA-256連鎖の先頭12文字と連鎖検査結果を表示します。機能要約値が同じ直前の版8を新しいブラウザー保存領域から実行し、2試行、予約1件、処理開始1回、同じ確認番号の再読込復元を確認しました。版9では匿名表示と配信一致まで確認し、この実操作は再試験していません。この表示は端末内履歴の可視化であり、実在する外部予約の証明ではありません。

## 保存範囲

保存先はブラウザーのIndexedDBです。ChatGPT SitesとVercelは別の公開元なので、保存領域を共有しません。画面に「この端末・この公開先だけの架空予約」と表示します。サーバーデータベース、ファイル保管、OpenAI API鍵は使いません。

## 現在の検査結果

| 検査 | 結果 | 根拠 |
|---|---|---|
| 言語変更でも同じUUIDv5 | 成功 | Node試験 |
| 二つのタブ、連打、再読込、複数再送 | 成功 | 競合試験と任意条件のChrome実画面 |
| 2試行、予約ストア物理1行、1確認番号、処理開始1 | 成功 | Node試験とアプリ内ブラウザー |
| WebMCP四機能の発見と実行 | 成功 | 一般公開の安全版依存を使う版10で四機能を発見し、`get_hotel_booking_status`を実行。版11は同じ機能要約値を保持 |
| 120秒の準備失効 | 成功 | 読み取りは期限切れを即時表示し、画面処理が`EXPIRED`イベントを一度だけ永続化 |
| 本番構築物の通信断後復元 | 成功 | 現行構築物を強制通信断中に再読込し、2試行、1予約、処理開始1を復元 |
| 320、375、390、768ピクセル | 成功 | 横はみ出しなし、操作部品44ピクセル以上 |
| キーボード移動 | 判断不能 | 操作基盤がTab移動を再現できず、物理キーボード確認が必要 |
| 読み上げ | 判断不能 | 構造は確認済み、VoiceOver実行は未記録 |
| ChatGPT Sites一般公開 | 成功（現行版） | [本番URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site)の版12は提供元報告コミット`f832cc611ed43613035a8735ca97d4bc1a0a8efc`を履歴外観測として保持し、現在のチェックアウトと完全パッケージ要約値を再現境界にする。配置`appgdep_6a92e425bbdc8191ac9ca35d524f61a0`。匿名HTTP 200と四つの静的ファイル一致を確認。再送収束は同じ機能要約値の版10から引き継ぎ、版12で再実行したとは扱わない |
| 可視証拠パネル | 成功（現行機能） | 版10でUUIDv5`64ccc2dc-0404-5566-b296-92d0eb7ed00f`、最新UUIDv7、履歴4件、SHA-256連鎖`Valid`を確認。版11で同じ結果を復元 |
| Vercel一般公開 | 成功（現行版） | 提供元がクリーン状態として報告した履歴外コミット`e3d3bb7ccc142a50a2a7af29dad4cd7bb449c4cb`を観測値として分離した配置`dpl_ArJPwr1h3KqyxmRRfegcbX4YqTB2`を[ホテル専用URL](https://kyoto-booking-retry-proof.vercel.app)と[配置固有URL](https://kyoto-booking-retry-proof-kafikuvr2-aniotajp-1978s-projects.vercel.app)で匿名確認。現在のチェックアウトの成果物要約値を再現境界とし、5ファイル一致、警告・エラー0件。再送収束は同じ機能要約値の直前配置`dpl_4uthDyjgSi1KxbssW9t5u18xJbLs`から引き継ぎ、現行配置で再実行したとは扱わない |

Sitesの機械可読正本は[`metadata/hotel-booking-verification.json`](../metadata/hotel-booking-verification.json)、Vercelの正本は[`metadata/vercel-hotel-deployment.json`](../metadata/vercel-hotel-deployment.json)です。二つの提供元の配置証拠を混ぜません。

## 公開、動画、Devpostの現在状態

- 安全版依存を使う機能コミット`5ac1fe51a29800eb052f9a63e7311559b7c01e45`は、ChatGPT Sites版10でWebMCP四機能、人間確認境界、2試行から1予約・処理開始1回への収束を実測しました。最終状態を含む提供元報告コミット`f832cc611ed43613035a8735ca97d4bc1a0a8efc`は履歴外の観測として保持し、版12の現在チェックアウトと完全パッケージ要約値を再現境界として、版識別子`appgprj_6a923239002081918896546134a7dc8f~appgver_feeff1aa402c8191a02e0945d9cdd04e`、配置`appgdep_6a92e425bbdc8191ac9ca35d524f61a0`から同じURLへ一般公開済みです。匿名HTTP 200と四つの静的ファイル一致を確認しました。版12の機能要約値は版10と同一なので実操作証拠を引き継ぎますが、版12で再実行したとは主張しません。
- Vercelでは直前配置`dpl_4uthDyjgSi1KxbssW9t5u18xJbLs`で同じ再送収束を実測しました。現行配置`dpl_ArJPwr1h3KqyxmRRfegcbX4YqTB2`は提供元のクリーン状態と履歴外コミット観測を分離し、現在のチェックアウトの成果物要約値を再現境界として、`2026-08-29T13:35:38.108Z`に`READY`となりました。[一般公開URL](https://kyoto-booking-retry-proof.vercel.app)と[配置固有URL](https://kyoto-booking-retry-proof-kafikuvr2-aniotajp-1978s-projects.vercel.app)から取得した五つのファイルは端末内成果物と一致し、提供元の警告・エラー読み戻しはともに0件でした。機能要約値`06a753e5cd240eebd0663c57031a0993e87cbb87c7d61401eb220dbacd91e132`は直前配置と同じなので実操作証拠を引き継ぎますが、現行配置で新たに実操作したとは主張しません。誤って対象にした旧通知プロジェクトは配置`dpl_3KTHTtZ5h8quDhviMTRo5GxBuUuE`へ復旧済みで、現在も別プロジェクトです。
- 端末内で検査した最終動画v10は150秒、1920×1080、英語音声あり、英語字幕焼き込み済みです。生成映像20秒には架空表示があり、公開Site画面録画は113.2秒（75.5%）です。端末内ファイルのSHA-256は`3c2635029fe01f5a9f20b4effddd62a8d5c1edc28e1e90db443645dbe78c49e7`です。これとは別に、[YouTube](https://youtu.be/tdSvJw4ghX8)で`WebMCP vs Duplicate Bookings: A Live Demo`の一般公開、150秒の再生時間、匿名再生、英語字幕と日本語字幕トラック、処理完了、著作権検査の問題なしを読み戻しました。リポジトリ内にはアップロード操作由来の独立した受領記録がないため、端末内ファイルと公開動画が同一成果物であることは`UNMEASURED`であり、同一だとは断定しません。時間の一致と編集可能な自己記録は成果物同一性の根拠にしません。
- Canvaで選んだ専用サムネイルは端末内に準備済みです。ただしYouTube画面のブラウザー用ファイル選択が失敗し、専用画像は反映できなかったため、現在はYouTubeが自動生成したサムネイルを使っています。これはYouTubeだけの状態です。
- Devpostの[一般プロジェクトページ](https://devpost.com/software/project-y79pb23hj1mz)は、画面の題名と見出しを`Kyoto Booking Retry Proof`にし、京都のホテル二重予約防止に絞った説明、公開URL、YouTube動画、153件のNode試験を反映しました。版8で説明、版9で技術・リンク・動画、版10で冒頭の式・見出し・再送結果リスト、版11で60秒の四手順を整えています。提出後の匿名HTMLでは`og:title`も`Kyoto Booking Retry Proof`、`og:image`も[アップロード済みホテル画像](https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/005/194/459/datas/medium.png)になりました。提出番号`1158722`は`Submitted`で、送信応答と認証済みプロジェクト読み戻しの`submitted_at`は`2026-08-29T09:14:00.129-04:00`で一致しました。

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
