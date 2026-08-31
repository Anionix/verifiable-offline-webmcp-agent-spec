---
title: "訪日旅行者向け・ホテル二重予約防止デモ"
language: "ja"
information_uuid_v5: "f91481fd-f6f9-53e4-8b23-b97065177b32"
event_uuid_v7: "01a04dcb-8678-79cc-97a7-5daac61059f8"
public_release_alignment_event_uuid_v7: "01a0576f-4c85-7731-b4b3-3833d8af4a2f"
observed_at: "2026-08-31T10:48:27.013Z"
status: "sites-version-14-vercel-release-current-devpost-version-16-aligned"
---

# 訪日旅行者向け・ホテル二重予約防止デモ

## 一言でいうと

通信が切れて成功画面を受け取れなくても、同じ予約をもう一件作らず、最初の確認番号を取り戻す架空デモです。対象は`Fictional Kyoto Ryokan`の`Standard Flexible`だけです。実ホテル、個人情報、決済、メール、外部予約、実際の取消は扱いません。

<!-- information_uuid_v5=6ecef8ee-286c-5cf0-a6df-b67de6b774bc -->
<!-- event_uuid_v7=01a04bd0-b895-7093-97cf-ad532592a07f state_transition=EMPTY -> PREPARED -> HUMAN_APPROVED -> COMMITTED -> RETRY_RECOGNIZED occurred_at=2026-08-29T01:25:00Z -->
<!-- machine-contract=Only the visible human button can commit. WebMCP can check, prepare, read status, and preview cancellation terms; it cannot confirm, pay, or cancel. -->
<!-- information_uuid_v5=4d5c7c5c-98a2-5a34-8d40-d4a8f8d77f0e -->
<!-- event_uuid_v7=01a050d2-0000-7000-8000-000000000189 state_transition=PREPARED -> EXPIRED -> PREPARED occurred_at=2026-08-30T20:00:00.000+09:00 -->
<!-- machine-contract=期限切れ後の再準備は同じ予約識別子を保ち、新しい準備時間と承認要約値を発行し、予約処理を増やさない。 -->

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
- 期限到達は画面の時計、再読込、再準備のいずれでも`PREPARED → EXPIRED`として一度だけ記録され、予約処理は始まりません。期限切れ後の再準備は同じUUIDv5の予約識別子を保ったまま`EXPIRED → PREPARED`を記録し、準備時刻、失効時刻、承認要約値だけを更新します。

## 画面に出る検証証拠

ChatGPT Sites版14の画面には、端末内履歴から読む検証パネルがあり、同じ予約条件を表すUUIDv5、履歴件数、最新イベントのUUIDv7、SHA-256連鎖の先頭12文字と連鎖検査結果を表示します。Sites版14とVercelの匿名評価ファイルは、194件の試験と同じ四機能の境界を報告します。ネイティブWebMCPの新しい実行は、この公開先同期記録からは主張しません。この表示と記録は端末内履歴の可視化であり、実在する外部予約の証明ではありません。

## 保存範囲

保存先はブラウザーのIndexedDBです。ChatGPT SitesとVercelは別の公開元なので、保存領域を共有しません。画面に「この端末・この公開先だけの架空予約」と表示します。サーバーデータベース、ファイル保管、OpenAI API鍵は使いません。

## 現在の検査結果

| 検査 | 結果 | 根拠 |
|---|---|---|
| 言語変更でも同じUUIDv5 | 成功 | Node試験 |
| 二つのタブ、連打、再読込、複数再送 | 成功 | 競合試験と任意条件のChrome実画面 |
| 2試行、予約ストア物理1行、1確認番号、処理開始1 | 成功 | Node試験とアプリ内ブラウザー |
| WebMCP四機能の発見と実行 | 成功 | 一般公開の安全版依存を使う記録で四機能を発見し、`get_hotel_booking_status`を実行。Sites版14は同じ機能要約値を保持 |
| ネイティブWebMCPの発見と再送前の状態確認 | 成功 | Vercel本番版で`document.modelContext`と意図した四機能を確認。発見時の予約・処理開始・外部通信・権限要求・通知は0件。成功応答を隠した後、`get_hotel_booking_status`で既存結果を確認してから再送 |
| 120秒の準備失効と再準備 | 成功 | 読み取りは期限切れを即時表示し、再準備が`PREPARED → EXPIRED → PREPARED`を一度ずつ永続化。新しい承認後も予約ストア物理1行、処理開始1回 |
| 本番構築物の通信断後復元 | 成功 | 現行構築物を強制通信断中に再読込し、2試行、1予約、処理開始1を復元 |
| 320、375、390、768ピクセル | 成功 | 横はみ出しなし、操作部品44ピクセル以上 |
| キーボード移動 | 判断不能 | 操作基盤がTab移動を再現できず、物理キーボード確認が必要 |
| 読み上げ | 判断不能 | 構造は確認済み、VoiceOver実行は未記録 |
| ChatGPT Sites一般公開 | 成功（現行版） | [本番URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site)は公開中の版14で、提供元コミット`2fbbf1b714ca660ef1681239b638205a9835f7c5`へ結び付く。匿名評価ファイルはHTTP 200、194件の試験、四機能、再送の契約を報告する。版14で新しいネイティブ実行を行ったとは扱わない |
| 可視証拠パネル | 成功（現行機能） | 版10でUUIDv5`64ccc2dc-0404-5566-b296-92d0eb7ed00f`、最新UUIDv7、履歴4件、SHA-256連鎖`Valid`を確認。版11で同じ結果を復元 |
| Vercel一般公開 | 成功（現行版） | 本番配置`dpl_HWJVg4uCgFEaq9N2f5kvXwLjvK2E`はソースコミット`2d5abd679893ec7dff36758925477999424c3cc7`へ結び付く。匿名取得した評価ファイルはHTTP 200、194件のNode試験、四機能、再送の契約を報告する。ネイティブ実行は公開HTTPS別名で別に実測した |

Sitesの機械可読正本は[`metadata/hotel-booking-verification.json`](../metadata/hotel-booking-verification.json)、過去のVercel配置記録は[`metadata/vercel-hotel-deployment.json`](../metadata/vercel-hotel-deployment.json)、現在のVercel公開読戻しは[`metadata/hotel-public-release-readback.json`](../metadata/hotel-public-release-readback.json)、ネイティブ実測は[`metadata/hotel-native-webmcp-reconciliation.json`](../metadata/hotel-native-webmcp-reconciliation.json)です。二つの提供元の配置証拠を混ぜません。

## 公開、動画、Devpostの現在状態

- [公開版の対応表](../metadata/public-release-alignment-readback.json)は、Sites版14、Vercel本番、Devpost版16を別々に読み取り、提出先URL、版、ソース、HTTP 200、194件、四機能、未計測の境界を一つの機械可読記録へ結び付けています。古い版11と版13のDevpost記録は履歴として保持します。
- Vercelの本番配置`dpl_HWJVg4uCgFEaq9N2f5kvXwLjvK2E`はソースコミット`2d5abd679893ec7dff36758925477999424c3cc7`へ結び付き、`2026-08-31T10:31:51.086Z`に`READY`となりました。[一般公開URL](https://kyoto-booking-retry-proof.vercel.app)の匿名評価ファイルはHTTP 200と194件を返します。Sites版14の公開元は`2fbbf1b714ca660ef1681239b638205a9835f7c5`です。ネイティブWebMCPは公開HTTPS別名で`2026-08-31T10:45:19.736Z`まで実測し、状態確認後の再送を記録しました。外部効果は測定していません。配置固有URLは別途読み戻しましたが、分離ブラウザーではサインインへ転送されたため、実行は一般公開URLで行いました。誤って対象にした旧通知プロジェクトは配置`dpl_3KTHTtZ5h8quDhviMTRo5GxBuUuE`へ復旧済みで、現在も別プロジェクトです。
- 端末内で検査した最終動画v10は150秒、1920×1080、英語音声あり、英語字幕焼き込み済みです。生成映像20秒には架空表示があり、公開Site画面録画は113.2秒（75.5%）です。端末内ファイルのSHA-256は`3c2635029fe01f5a9f20b4effddd62a8d5c1edc28e1e90db443645dbe78c49e7`です。これとは別に、[YouTube](https://youtu.be/tdSvJw4ghX8)で`WebMCP vs Duplicate Bookings: A Live Demo`の一般公開、150秒の再生時間、匿名再生、英語字幕と日本語字幕トラック、処理完了、著作権検査の問題なしを読み戻しました。リポジトリ内にはアップロード操作由来の独立した受領記録がないため、端末内ファイルと公開動画が同一成果物であることは`UNMEASURED`であり、同一だとは断定しません。時間の一致と編集可能な自己記録は成果物同一性の根拠にしません。
- Canvaで選んだ専用サムネイルは端末内に準備済みです。ただしYouTube画面のブラウザー用ファイル選択が失敗し、専用画像は反映できなかったため、現在はYouTubeが自動生成したサムネイルを使っています。これはYouTubeだけの状態です。
- Devpostの[一般プロジェクトページ](https://devpost.com/software/project-y79pb23hj1mz)は、版16として提出先をChatGPT Sites版14へ戻し、Vercelの確認対象配置、194件のNode試験、四機能の契約、状態確認後の安全な再送を反映しています。提出先URLと本文の対応は[公開版の対応表](../metadata/public-release-alignment-readback.json)で確認できます。提出番号`1158722`は`Submitted`のままです。版16の説明更新は読み戻し済みで、新しい提出受領番号は作っていません。過去の版11・版13・153件スナップショットは履歴として保存しています。

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
