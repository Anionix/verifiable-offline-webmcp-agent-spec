---
title: サービス連携状態の読み方
information_uuid_v5: "49a43c43-3343-5bbb-8864-c5defebddc73"
event_uuid_v7: "01a04c37-78f2-75ee-bef1-ad3a48c0dc16"
observed_at: "2026-08-29T06:31:43.000Z"
state_transition: "VERSION_7_AND_VERCEL_RELEASE_READ_BACK -> DEVPOST_PROJECT_PAGE_PUBLISHED"
---

# サービス連携状態の読み方

この記録は、サービスが「使える」という一語を四つの事実へ分けます。導入できていても、ログインできているとは限りません。ログインできても、今回のホテル実演が公開済みとは限りません。公開済みでも、今回の成果物を実際に動かした証拠がなければ動作確認済みとはしません。

さらに導入の内訳として、端末へ正式導入されたか、今回のメッセージへ添付されたか、現在の作業から操作可能かを別々に記録します。`pluginState`の`ACTIVE`は「現在の作業から操作可能」という意味であり、端末への正式導入だけを表す値ではありません。

機械が読む正本は[`metadata/service-integration-registry.json`](../metadata/service-integration-registry.json)、形式の契約は[`schemas/service-integration-registry.schema.json`](../schemas/service-integration-registry.schema.json)、検査処理は[`scripts/validate_service_integrations.mjs`](../scripts/validate_service_integrations.mjs)です。

## 四つの状態

| 観点 | 状態 | 意味 |
|---|---|---|
| 導入 | `ACTIVE` | 現在の作業から操作機能を利用できる |
| 導入 | `INSTALLED_INACTIVE` | 導入済みだが、現在の作業では操作できない |
| 導入 | `NOT_INSTALLED` | 端末の導入一覧にない |
| 導入 | `NOT_APPLICABLE` | そのサービスでは追加機能を必要としない |
| 認証 | `CONFIRMED` | 名前を記録した操作が実際に成功した |
| 認証 | `UNVERIFIED` | ログイン成功を示す保存済み証拠がない |
| 認証 | `REJECTED` | 認証を試したが拒否された |
| 認証 | `NOT_APPLICABLE` | 認証が要らない役割である |
| 公開 | `CURRENT_ARTIFACT` | 今回の成果物と結び付いた公開証拠がある |
| 公開 | `BASELINE_ONLY` | 過去または別成果物の公開だけを確認した |
| 公開 | `NOT_PUBLISHED` | 今回の成果物をまだ公開していない |
| 公開 | `UNVERIFIED` | 公開の有無を確認できない |
| 公開 | `NOT_APPLICABLE` | 公開先として使わない |
| 実行 | `CURRENT_ARTIFACT_VERIFIED` | 今回の成果物を実際に動かした証拠がある |
| 実行 | `BASELINE_ONLY` | 過去または別成果物の動作だけを確認した |
| 実行 | `INCONCLUSIVE` | 試したが、成功か失敗かを判断できない |
| 実行 | `NOT_RUN` | 今回の成果物ではまだ試していない |
| 実行 | `NOT_APPLICABLE` | 実行確認の対象ではない |

## 現在の記録

最新の記録更新は2026年8月29日5時22分22秒（協定世界時）です。認証は、現在の作業で名前付きの読み取りまたは書き込み操作が実際に成功したサービスだけを成功扱いしています。認証成功から、公開成功や今回の成果物の実行成功は推測していません。

| サービス | 導入 | 認証 | 公開 | 実行 | 今回の役割 |
|---|---|---|---|---|---|
| ChatGPT Sites | `ACTIVE` | `CONFIRMED` | `CURRENT_ARTIFACT` | `CURRENT_ARTIFACT_VERIFIED` | 主公開先。一般公開の版7を実行済み、同じ機能の版5を画面録画済み |
| Vercel | `ACTIVE` | `CONFIRMED` | `CURRENT_ARTIFACT` | `CURRENT_ARTIFACT_VERIFIED` | 予備公開先。ホテル専用プロジェクトを匿名実行済み |
| Cloudflare | `ACTIVE` | `CONFIRMED` | `NOT_PUBLISHED` | `NOT_RUN` | ChatGPT Sites向け実行形式と将来の公開候補 |
| Netlify | `ACTIVE` | `CONFIRMED` | `NOT_PUBLISHED` | `NOT_RUN` | リポジトリ内の公開先パスと設定構文だけ確認 |
| Render | `ACTIVE` | `CONFIRMED` | `NOT_PUBLISHED` | `NOT_RUN` | リポジトリ内の公開先パスと設定構文だけ確認 |
| Shopify | `ACTIVE` | `CONFIRMED` | `NOT_APPLICABLE` | `NOT_APPLICABLE` | 商取引との境界説明だけ |
| Google Chrome | `ACTIVE` | `NOT_APPLICABLE` | `NOT_APPLICABLE` | `INCONCLUSIVE` | 一般公開版の画面は確認済み。ChromeのWebMCP実行機能は未露出 |
| Devpost | `ACTIVE` | `CONFIRMED` | `CURRENT_ARTIFACT` | `NOT_APPLICABLE` | 現行説明と公開URLを載せたプロジェクトページ。最終提出は別 |

Devpostでは、[プロジェクトページ](https://devpost.com/software/project-y79pb23hj1mz)へ現行説明、ChatGPT Sites、Vercel、公開リポジトリを反映しました。提供元の読み戻しは版5・状態`published`で、未ログインのHTTP 200応答も確認しました。名称は利用者が決めるため`未定`のままです。動画URLは空、WebMCP Challengeの`submitted_at`も空なので、一般プロジェクトページの公開を最終提出とは扱いません。

ChatGPT Sitesでは、機能コミット`a628eb9a91d310393a3b69b1130ab92871054d16`を含む正確な配置元コミット`34eaed29c397d383cff264a7b86a7ff72a28c083`を版7として[一般公開の本番URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site)へ配置しました。版7で未ログイン表示、現在のSites・Vercel状態表、準備、人間の画面操作による確定、安全な再送、再読込復元を実行しました。結果は試行二回、架空予約一件、処理開始一回、確認番号一件です。完成動画の動く操作部分は同じ機能要約値を持つ版5を収録し、終盤には現在の一般公開版7から取得したサービス状態表と再送結果の実画面キャプチャを表示します。

Vercelでは、Sites版7と同じ確定コミット`34eaed29c397d383cff264a7b86a7ff72a28c083`をホテル専用プロジェクトへ配置し、[一般公開URL](https://kyoto-booking-retry-proof.vercel.app)の匿名200応答を確認しました。新しいブラウザー保存領域で`PREPARED → COMMITTED → RETRY_RECOGNIZED`を操作し、2試行、架空予約1件、処理開始1回、同じ確認番号、再読込復元、履歴4件、SHA-256連鎖`Valid`、ブラウザーの誤り・警告0件を確認しました。さらに公開別名から五ファイルをキャッシュ回避で読み戻し、端末内の確定構築物と一バイトずつ一致する要約値を記録しました。正確な提供元識別子は[`metadata/vercel-hotel-deployment.json`](../metadata/vercel-hotel-deployment.json)へ分離し、Sites専用の配置記録を上書きしません。

ホテル版は新しいVercelプロジェクトへ分離しました。既存の通知実演プロジェクトは元の配置`8e0191c3a9ea7b1e64a954cc20fd8e5e357f34d2`へ戻し、[従来URL](https://verifiable-offline-webmcp-agent-spe.vercel.app)を維持しています。両プロジェクトともGit自動配置ではなく、確定コミットだけを含む隔離作業場所から手動配置しました。

NetlifyとRenderは、リポジトリ内の公開先パスと限定した設定構文だけを端末内で検査しています。提供元による設定検証、外部配置、外部URLでの実行確認は行っていないため、実行状態は`NOT_RUN`です。

### 導入の内訳

| サービス | 端末へ正式導入 | メッセージ添付 | 現在操作可能 | 再起動 |
|---|---|---|---|---|
| ChatGPT Sites | 導入・有効 | あり | はい | 不要 |
| Vercel | 導入・有効 | あり | はい | 不要 |
| Cloudflare | 導入・有効 | あり | はい | 不要 |
| Netlify | 今回導入・有効 | あり | はい | 今回の作業後に一回必要 |
| Render | 今回導入・有効 | あり | はい | 今回の作業後に一回必要 |
| Shopify | 今回導入・有効 | あり | はい | 今回の作業後に一回必要 |
| Google Chrome | 導入・有効 | なし | はい | 不要 |
| Devpost | 端末へは未導入 | あり | はい | 対象外 |

再起動待ちの三サービスも、今回の作業では添付された操作機能から読み取りが成功しています。再起動前の添付成功と、再起動後の正式導入読み戻しは同じ証拠として扱いません。

Shopifyは商品検索、買い物かご、購入画面、注文履歴に関する商取引の境界を説明するだけです。ホテル予約の操作機能として接続しません。

Google Chromeでは一般公開の版6を未ログインで表示し、初期状態、再送比較、四つの安全な機能カードを確認しました。ただし`document.modelContext`は未定義で、ChromeのWebMCP実行機能はページへ露出しませんでした。したがって、画面表示は確認済みですが、Chromeでの四機能の発見・実行は`INCONCLUSIVE`のままです。

## 外部操作の承認境界

`approvalGates`は、公開、提出、商取引の書き込みをサービスごと、操作ごとに止める機械向けの門です。一つの操作への許可を、別の操作への許可として使い回しません。

| サービス | 操作 | 現在の承認状態 | 実行境界 |
|---|---|---|---|
| ChatGPT Sites | `OWNER_ONLY_DEPLOYMENT` | `AUTHORIZED_BY_PLAN` | 所有者だけが見られる初回公開は計画で許可済み |
| ChatGPT Sites | `PUBLIC_DEPLOYMENT` | `AUTHORIZED_BY_USER` | 利用者の「公開しながら作っていいです」を根拠に一般公開済み |
| Vercel | `PRODUCTION_DEPLOYMENT` | `AUTHORIZED_BY_USER` | 利用者の「公開しながら作っていいです」を根拠にホテル専用プロジェクトへ一般公開済み |
| Cloudflare | `PUBLIC_DEPLOYMENT` | `OUT_OF_SCOPE` | 今回は一般公開しない |
| Netlify | `PUBLIC_DEPLOYMENT` | `OUT_OF_SCOPE` | 今回は構成確認だけで、一般公開しない |
| Render | `PUBLIC_DEPLOYMENT` | `OUT_OF_SCOPE` | 今回は構成確認だけで、一般公開しない |
| Shopify | `COMMERCE_WRITE` | `OUT_OF_SCOPE` | 商品、買い物かご、購入、注文を書き換えない |
| Google Chrome | `PUBLIC_DEPLOYMENT` | `NOT_APPLICABLE` | 検査用ブラウザーであり、公開先ではない |
| Devpost | `DRAFT_UPDATE` | `AUTHORIZED_BY_PLAN` | 下書き更新は計画で許可済み |
| Devpost | `FINAL_SUBMISSION` | `REQUIRES_SEPARATE_APPROVAL` | 最終提出の直前に別の確認が必要 |

`AUTHORIZED_BY_USER`は、利用者が対象操作を明示的に許可した後にだけ使います。現在はChatGPT SitesとVercelの一般公開に使っています。`REQUIRES_SEPARATE_APPROVAL`と`OUT_OF_SCOPE`の操作は実行しません。

## 認証を成功扱いする条件

`verifiedAuthOperations`には、実際に成功した操作だけを`READ:操作名`または`WRITE:操作名`として記録します。

- 読み取り成功から、書き込み成功を推測しません。
- `CONFIRMED`へ変えるときは、少なくとも一つの操作名を残します。
- `UNVERIFIED`、`REJECTED`、`NOT_APPLICABLE`では、成功操作の配列を空にします。
- 秘密値そのものは、記録、文書、生成物、Gitのどこにも保存しません。

## 今回の成果物を成功扱いする条件

`CURRENT_ARTIFACT`または`CURRENT_ARTIFACT_VERIFIED`へ変える場合は、`artifactCommit`と`artifactSha256`の両方が必要です。元のコードと公開した成果物を一緒に結び付けるため、古い公開先が偶然動いた事実を今回のホテル実演の成功へすり替えられません。

`artifactCommit`は、画面と予約処理を作った機能ソースのコミットを指します。`artifactSha256`は、状態表そのものを除外した機能部分の要約値です。状態表は自分自身の公開結果を記録するため、機能要約値からだけ除外し、完全な配布物要約値には含めます。これにより、公開観測の追記で機能が変わったように見せず、配布物全体の変化は隠しません。

公開と実行確認は別々に更新します。たとえば公開操作が成功しても、匿名アクセス、画面表示、四つのWebMCP機能を確認するまでは実行を成功扱いしません。

## 検査内容

次のコマンドは、公開処理や外部通信を行わず、端末内の記録だけを検査します。

```sh
node scripts/validate_service_integrations.mjs
```

検査する内容は次のとおりです。

1. 正本が指定のJSON Schemaに従うこと。
2. 八サービスと四つの状態集合が過不足なく存在すること。
3. 連携面のUUIDv5がサービス名から再計算した値と一致すること。
4. 観測のUUIDv7が観測時刻と一秒以内で一致し、重複しないこと。
5. 参照先がサービスごとの公式HTTPS情報源だけであること。
6. 秘密値らしい文字列を含まないこと。
7. SitesとVercelを分けた必須の六ファイルが存在すること。
8. 集計値が八行から再計算した値と一致すること。
9. `dist/client/service-integrations.json`が生成済みなら、正本と完全一致すること。
10. 八サービスの承認門が、上表の操作と承認状態に完全一致すること。
11. 今回成果物の実行成功は今回成果物の公開に、過去成果物の実行証拠は過去成果物の公開に対応すること。
12. Vercelの成功表示が、専用プロジェクト、READY配置、匿名200応答、実ブラウザーの再送収束、旧通知配置の復元証拠と一致すること。

生成前は配布用写しがなくても成功します。生成後は写しが存在するため、不一致を失敗にします。

## 一次情報源

- [ChatGPT Sites](https://learn.chatgpt.com/docs/sites)
- [Vercelの公開](https://vercel.com/docs/deployments)
- [CloudflareのVite連携](https://developers.cloudflare.com/workers/vite-plugin/)
- [Netlifyの公開](https://docs.netlify.com/deploy/create-deploys/)
- [Renderの静的サイト](https://render.com/docs/static-sites)
- [Shopify WebMCP](https://shopify.dev/docs/api/web-mcp)
- [Google Chrome WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome開発者機能のWebMCP画面](https://developer.chrome.com/docs/devtools/application/webmcp)
- [Devpost WebMCP Challenge資料](https://webmcp.devpost.com/resources)
