<!-- information_uuid_v5=f2c53e75-efab-5844-9bfa-f0099a91d708 -->
<!-- event_uuid_v7=01a04a91-75c4-714d-a763-19bb683c0920 state_transition=OFFICIAL_RESOURCES_COLLECTED -> SERVICE_BOUNDARIES_DOCUMENTED occurred_at=2026-08-28T22:50:41Z -->
<!-- information_uuid_v5=b870cb89-abac-5f10-b26c-07f0adb6abce -->
<!-- event_uuid_v7=01a04a9c-0fd2-7d73-9460-3e49ff34a694 state_transition=SERVICE_BOUNDARIES_DOCUMENTED -> DUPLICATE_RISK_VALUE_DOCUMENTED occurred_at=2026-08-28T23:02:16.786Z -->
<!-- machine-contract=An integration state records verified evidence, not intent; CONFIGURED must never be read as DEPLOYED. -->
<!-- machine-contract=Every service scenario is illustrative and unobserved; each scenario is paired with one potential prevented outcome. -->

# 二重送信を防ぐ8サービスの連携境界

応答が消えたり通信が切り替わったりすると、エージェントは同じ操作を再試行することがあります。相手に届いた後で応答だけが消えていた場合、通知、依頼、予約、購入に関わる操作が2回実行されるおそれがあります。1つの論理操作に同じ識別子を使い、外部効果を1回に制限する価値は、余計な費用、混乱、信用低下、取消対応を減らせることです。

この文書でいう「統合」は、同じ静的成果物またはWebMCPの道具を接続できる境界を整えることです。全サービスで本番配置や実利用を実証した、という意味ではありません。次の例はすべて設計を確認するための**想定シナリオであり、各サービスで実測した事故ではありません**。

画面と機械可読台帳は同じ5状態を使います。

- `VERIFIED`: 公開先と主要な安全境界を実際に確認済み
- `CONFIGURED`: リポジトリ内の設定と検査を用意済み。外部配置は未実施
- `INCONCLUSIVE`: 接続方法は定義済みだが、この実行環境では判定できない
- `BOUNDARY_ONLY`: 現在の通知デモへ機能を足さず、役割と権限境界だけを定義
- `RESOURCE_CONFIRMED`: 公式資料を確認済み。実行環境の検証を意味しない

状態の正本は公開時の `/service-integrations.json` です。画面上の8カードには `data-service-id` と `data-integration-state` があり、検査器から追跡できます。

## 二重送信が生活へ与える影響

| サービス | 想定シナリオ（未実測） | 防げる価値 |
| --- | --- | --- |
| OpenAI | 応答消失後の再実行で同じ通知や依頼が相手へ2回届く | 相手の混乱、信用低下、取消対応を減らす |
| Cloudflare | 移動通信の切替後、Cloudflare公開ページ上の操作が再試行され、同じ警告や外部通知が2回届く | 重複処理、費用、後片付けを減らす |
| Vercel | Vercel公開ページの二度押しや再読込で同じ通知が2回届く | 混乱を減らし、利用者の信用を守る |
| Shopify | カートへの商品追加が2回実行され、1個のつもりが2個になる | カート修正、余計な費用、返金、問い合わせ対応を減らす |
| Google Chrome | ブラウザーのエージェント再試行で同じフォームや通知が2回送られる | 重複依頼、混乱、修正作業を減らす |
| Render | 将来の処理が完了後、受領確認前に再起動し、同じメールや仕事を2回実行する | 重複処理、費用、相手の不信を減らす |
| Netlify | Netlify公開フォームで通信が不安定になり、同じ予約や問い合わせが2回送られる | 予約衝突、確認作業、混乱を減らす |
| Devpost | チームの提出補助が版更新の通知を2回送り、最新版が分からなくなる | チームと審査側の混乱、信用低下を減らす |

## 今回、実際に確認した範囲

2026年8月28日23時13分10秒（協定世界時）のローカル確認では、アプリ内ブラウザーから`notify_once`へ同じ論理操作を2回渡しました。2回ともIntent識別子は`25a2b087-84df-545f-b744-b177d12dab05`、外部効果開始数は`0`、状態は`DRY_RUN / NOT_STARTED`でした。承認ボタンは押していません。320ピクセル幅では8カードが横にはみ出さず、ブラウザーの警告とエラーは0件でした。

この結果はローカル成果物の重複抑止契約を確認したものです。Cloudflare、Vercel、Render、Netlifyへの今回版の配置、OpenAIとGoogle Chromeの対象実行環境、Shopify店舗、Devpost提出を実証するものではありません。ページ内の`document.modelContext`は確認できなかったため、ネイティブWebMCP適合性は`INCONCLUSIVE`のままです。証拠イベントは`01a04aa6-0a41-749e-b9d0-dd06d3e9c665`です。

## サービス別の現在地

| Service | Current state | What is wired | What remains | Approval required |
| --- | --- | --- | --- | --- |
| OpenAI | `INCONCLUSIVE` | ChatGPT内蔵ブラウザーがページの道具を利用する境界と、Sitesが静的成果物を公開する境界を定義 | 実アカウントでのSites公開と内蔵ブラウザー実行 | ログイン、Sites公開、ページ上の通知許可 |
| Cloudflare | `CONFIGURED` | Workers Static Assets向け設定と同じ`dist`成果物を利用 | アカウント接続、配置、任意のBrowser Run試験 | ログイン、課金またはクレジット利用、外部配置 |
| Vercel | `CONFIGURED` | 以前の成果物は公開・確認済み。今回の8サービス台帳を含む成果物はローカル検査済み | 今回の成果物を再配置し、応答、安全ヘッダー、成果物要約値を再確認 | 本番再配置。自動配置の有効化は別承認 |
| Shopify | `BOUNDARY_ONLY` | 店舗が商取引の道具を提供できる境界だけを記録 | 店舗、用途、顧客データ範囲、認可方式の合意後に別実装 | 店舗接続、認可、顧客データ利用、外部効果 |
| Google Chrome | `INCONCLUSIVE` | 評価ケース、審査手順、開発者ツールでの確認経路を公開 | 対応試験ブラウザーでのWebMCP本体確認 | 試験機能の有効化、通知許可 |
| Render | `CONFIGURED` | Static Site向け設定と同じ`dist`成果物を利用 | アカウント接続と配置 | ログイン、課金またはクレジット利用、外部配置 |
| Netlify | `CONFIGURED` | ファイル設定で同じ`dist`成果物を指定 | アカウント接続と配置 | ログイン、課金またはクレジット利用、外部配置 |
| Devpost | `RESOURCE_CONFIRMED` | 公式Resourcesを設計根拠として使用 | 登録状態、提出内容、動画、最終提出の確認 | 登録、提出、公開情報の確定 |

## ローカルで共通成果物を確認する

外部サービスへ接続する前に、リポジトリのルートで次を実行します。

```sh
npm run validate:vercel
```

この検査は静的成果物と台帳の整合性を確認します。外部サービスの可用性、本番配置、アカウント権限までは証明しません。

配置コマンドの例は `vercel --prod`、`npx wrangler deploy`、`netlify deploy --prod --dir=dist` です。ただし、この文書の作成時には実行していません。Renderは管理画面またはBlueprintから接続します。どの経路でも、ログイン先、対象プロジェクト、費用、公開範囲を人が確認してから配置します。

## 承認を越えない接続手順

1. `npm run validate:vercel` を成功させます。
2. `/service-integrations.json` と画面の8カードが同じ状態であることを確認します。
3. 利用するサービスを1つ選び、ログイン先、対象プロジェクト、公開URL、費用を表示します。
4. 人が承認したサービスだけへ配置します。別サービスへの承認として使い回しません。
5. 公開後にページの応答、安全ヘッダー、オフライン資産、乾式実行を再確認します。
6. 実測できなかった項目は `INCONCLUSIVE` または `UNMEASURED` のまま残します。

Shopifyはこの順序から独立しています。通知デモへ店舗機能を足すと、店舗認可、顧客データ、購入など権限の大きい外部効果が増えます。用途とデータ範囲の合意なしに接続しません。

Devpostも実行環境ではありません。Resourcesの確認と、作品登録・最終提出は別の状態です。公式資料を読んだことを、提出済みという証拠にはしません。

## 公式一次資料

- [Devpost WebMCP Challenge Resources](https://webmcp.devpost.com/resources)
- [OpenAI: Using site tools in the ChatGPT desktop app](https://help.openai.com/en/articles/20001423-using-site-tools-in-the-chatgpt-desktop-app)
- [OpenAI: ChatGPT Sites](https://learn.chatgpt.com/docs/sites)
- [Cloudflare Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/get-started/)
- [Cloudflare Browser Run WebMCP](https://developers.cloudflare.com/browser-run/features/webmcp/)
- [Vercel deployments](https://vercel.com/docs/deployments/overview)
- [Shopify WebMCP](https://shopify.dev/docs/api/web-mcp)
- [Google Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- [Render Static Sites](https://render.com/docs/static-sites)
- [Render Workflows](https://render.com/docs/workflows)
- [Netlify file-based build configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/)
- [Netlify Forms setup](https://docs.netlify.com/manage/forms/setup/)
