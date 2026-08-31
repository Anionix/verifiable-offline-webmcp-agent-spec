---
title: "Kyoto Booking Retry Proof — Devpost視覚導線"
language: "ja"
information_uuid_v5: "8919307c-9546-59bd-9054-fab238183fb5"
event_uuid_v7: "01a050c7-347d-71a4-91a0-42db9761ce31"
public_release_alignment_event_uuid_v7: "01a0576f-4c85-7731-b4b3-3833d8af4a2f"
state_transition: "TECHNICAL_DESCRIPTION_FIRST -> JUDGE_VISIBLE_PROOF_ROUTE_JA"
occurred_at: "2026-08-31T10:48:27.013Z"
status: "visual-guide-public-release-aligned"
---

# Devpost視覚導線（短い日本語版）

英語主表示のホテルデモを、10秒で理解し、60秒で試し、150秒動画で説明するための順番です。

## まず見せるもの

題名は**Kyoto Booking Retry Proof**、質問は**Did my hotel booking go through?**です。結果は`2 attempts → 1 simulated booking → 1 confirmation number`。入口は[公開ChatGPT Site](https://kyoto-booking-retry-proof.anionix.chatgpt.site)です。

提出先は[公開ChatGPT Site版14](https://kyoto-booking-retry-proof.anionix.chatgpt.site)、確認用の公開Vercel版は[こちら](https://kyoto-booking-retry-proof.vercel.app)です。Sites版14はソースコミット`2fbbf1b714ca660ef1681239b638205a9835f7c5`、Vercel本番の確認対象は配置`dpl_HWJVg4uCgFEaq9N2f5kvXwLjvK2E`とソースコミット`2d5abd679893ec7dff36758925477999424c3cc7`です。両方の評価ファイルは194件と四機能を報告し、対応表を[機械可読記録](../metadata/public-release-alignment-readback.json)に固定しています。ネイティブWebMCPは公開HTTPS別名で実行し、再送後の状態を別記録へ保存しています。配置固有URLは分離ブラウザーでサインインへ転送されたため、実行は一般公開URLで行いました。結果欄はページ通信や外部効果を測定しません。

## 60秒の順番

1. **1. Check and prepare**を押す。
2. `PREPARED`と料金・取消条件を確認し、**2. Confirm booking — human action only**を人間が一度だけ押す。
3. 成功応答が隠れた後、ネイティブWebMCPの`get_hotel_booking_status`で先に既存結果を確認する。
4. 同じ日付・人数・部屋数で**Retry the same booking**を押す。
5. `RETRY_RECOGNIZED`、試行2回、予約1件、効果開始1回、同じ確認番号を指す。

## 6枚の画面

| 名前 | 画面で見せるもの | 一言 |
|---|---|---|
| `01-hero-empty` | 質問、架空宿、`EMPTY`、結果の約束 | まず届いたかを確認する。 |
| `02-prepared` | `PREPARED`、料金、取消条件、120秒、人間確認 | エージェントは準備まで。 |
| `03-human-confirmation` | 人間だけの確定ボタン | 最終判断は旅行者。 |
| `04-committed-lost-response` | `COMMITTED`、端末内一件、成功応答消失 | 困る瞬間を再現する。 |
| `05-retry-recognized` | 試行2、予約1、効果開始1、同じ確認番号、証拠欄 | 再送しても一件。 |
| `06-tool-and-service-boundary` | 4機能、確定・決済・取消機能なし、サービス表 | できることと未確認を分ける。 |

## 150秒動画の見せ場

0:00–0:20はHiggsfieldの生成映像（画面に**AI-generated dramatization / Fictional booking**）。0:20以降は公開Siteの実画面を中心に、準備、人間確認、応答消失、ネイティブ状態取得、再送、UUIDv5、UUIDv7、SHA-256、サービス境界の順で進めます。生成映像は問題提起だけに使い、WebMCPの証拠にはしません。[英語の詳細導線](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.en.md)と[公開動画](https://youtu.be/tdSvJw4ghX8)を参照してください。

今回のネイティブWebMCP実測録画は、公開済み動画とは別の端末内記録です。公開済み動画に今回のネイティブ実測が含まれるとは、後から言い換えません。

## 表示しないもの

実ホテル、実在人物、住所、旅券、決済情報、予約メール、認証情報、実際の取消は出しません。これは端末内だけの架空予約です。確認したHTTPSのChrome設定ではネイティブWebMCPを実測済みですが、その設定を超える広い適合は主張しません。

## 審査ページの順番

画像 → 一行の困りごと → 60秒手順 → WebMCPの4機能 → 人間だけの確定 → 一件へ収束する証拠 → 架空・端末内の限界 → 公開Site、Vercel、リポジトリ、動画です。

関連する[配布README](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/examples/hotel-booking-demo/README.md)、[英語導線](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.en.md)、[公開読戻し記録](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/hotel-public-release-readback.json)、[公開版の対応表](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/public-release-alignment-readback.json)、[ネイティブWebMCP記録](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/hotel-native-webmcp-reconciliation.json)、[動画台本](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/media/demo-video/storyboard.md)も同じ順序を使います。
