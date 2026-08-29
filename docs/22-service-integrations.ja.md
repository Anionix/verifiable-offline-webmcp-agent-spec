---
title: サービス連携状態の読み方
information_uuid_v5: "49a43c43-3343-5bbb-8864-c5defebddc73"
event_uuid_v7: "01a04dcb-8678-7e22-973d-dc0d0617b0ce"
observed_at: "2026-08-29T13:52:59.000Z"
state_transition: "DEPENDABOT_ALERTS_ISSUE_TRACKED -> DEPENDENCY_GRAPH_PATCHED -> SITES_VERSION_10_AND_VERCEL_BROWSER_RUN_VERIFIED -> SITES_VERSION_11_AND_VERCEL_CURRENT_RELEASE_VERIFIED -> CODEQL_ALERTS_ISSUE_TRACKED -> LOCAL_SECURITY_PATCH_VALIDATED -> GITHUB_RESCAN_PENDING -> DEVPOST_VERSION_10_HOTEL_PROJECT_PACKET_READY -> DEVPOST_VERSION_11_SIXTY_SECOND_TEST_PUBLIC -> DEVPOST_OPEN_GRAPH_STALE_IMAGE_ASSOCIATION_INCONCLUSIVE -> VERCEL_CURRENT_DEPLOYMENT_READY_FIVE_FILES_MATCHED -> DEVPOST_FINAL_SUBMISSION_PENDING -> DEVPOST_FINAL_SUBMISSION_PROVIDER_VERIFIED -> SITES_VERSION_12_CURRENT_ARTIFACT_VERIFIED"
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

公開サービス状態の基準観測は2026年8月29日9時14分31秒（協定世界時）です。後続のセキュリティ検査は9時31分36秒に記録しました。Vercelの現行配置は13時35分38秒に`READY`となり、13時37分6秒までに提供元状態、二つの公開URL、五つの匿名配信ファイル、警告・エラーを読み戻しました。認証は、現在の作業で名前付きの読み取りまたは書き込み操作が実際に成功したサービスだけを成功扱いしています。認証成功から、公開成功や今回の成果物の実行成功は推測していません。

| サービス | 導入 | 認証 | 公開 | 実行 | 今回の役割 |
|---|---|---|---|---|---|
| ChatGPT Sites | `ACTIVE` | `CONFIRMED` | `CURRENT_ARTIFACT` | `CURRENT_ARTIFACT_VERIFIED` | 主公開先は版12。提供元が報告した版コミットは履歴外の観測として保持し、現在のチェックアウトと完全パッケージ要約値を再現境界にして、匿名HTTP 200と四つの静的ファイル一致を確認。実操作は同一機能要約値の版10から引き継ぐ |
| Vercel | `ACTIVE` | `CONFIRMED` | `CURRENT_ARTIFACT` | `CURRENT_ARTIFACT_VERIFIED` | 現行配置`dpl_ArJPwr1h3KqyxmRRfegcbX4YqTB2`は提供元のクリーン状態と履歴外コミット観測を分離して記録し、現在のチェックアウトの成果物要約値を再現境界にして匿名5ファイル一致と警告・エラー0件を確認。実操作証拠は同じ機能要約値の直前配置から引き継ぎ |
| Cloudflare | `ACTIVE` | `CONFIRMED` | `NOT_PUBLISHED` | `NOT_RUN` | ChatGPT Sites向け実行形式と将来の公開候補 |
| Netlify | `ACTIVE` | `CONFIRMED` | `NOT_PUBLISHED` | `NOT_RUN` | リポジトリ内の公開先パスと設定構文だけ確認 |
| Render | `ACTIVE` | `CONFIRMED` | `NOT_PUBLISHED` | `NOT_RUN` | リポジトリ内の公開先パスと設定構文だけ確認 |
| Shopify | `ACTIVE` | `CONFIRMED` | `NOT_APPLICABLE` | `NOT_APPLICABLE` | 商取引との境界説明だけ |
| Google Chrome | `ACTIVE` | `NOT_APPLICABLE` | `NOT_APPLICABLE` | `INCONCLUSIVE` | 一般公開版の画面は確認済み。ChromeのWebMCP実行機能は未露出 |
| Devpost | `ACTIVE` | `CONFIRMED` | `CURRENT_ARTIFACT` | `NOT_APPLICABLE` | 京都ホテル向け説明、公開URL、動画、60秒手順を揃えた版11。Open Graph画像を読み戻し、提出番号`1158722`は`Submitted` |

## Voidの端末内開発連携

<!-- information_uuid_v5=4a96e407-d7a0-5750-8fed-87c40066dea2 -->
<!-- event_uuid_v7=01a04c82-7268-7c70-b652-6c42e98c965b state_transition=VOID_NOT_CONFIGURED -> VOID_LOCAL_AND_GLOBAL_MCP_CONFIGURED -> VOID_STATIC_VALIDATE_READY -> VOID_AUTH_AND_DEPLOY_NOT_RUN occurred_at=2026-08-29T07:53:32.520Z -->
<!-- machine-contract=Void is a local development adapter outside the eight-service release registry until authentication, project linking, deployment, and public readback are separately observed. -->

Voidは、上の八サービスとは別の端末内開発補助として導入しました。端末内の開発依存は`0.10.12`へ完全一致で固定しています。Codex全体では`npx -y void@0.10.12 mcp`を有効化済みで、現在の処理へ途中から読み込ませず、Codex再起動後に利用します。

`void.json`は`dist/client`を対象にした静的アダプターです。データベース、キーと値、保管、人工知能の各結合をすべて無効にしています。既存のVite構成`cloudflare()`と`sites()`へ`voidPlugin`を追加しません。Voidは安全版へ更新したルート依存を共有し、Cloudflare Vite plug-inは`1.54.2`、Wranglerは`4.127.1`、Viteは`8.2.2`です。Dependabot警告17件は課題#73〜#89、CodeQL初回警告13件は課題#91〜#103へ、それぞれ一件ずつ結び付けました。CodeQL修正で使う推移依存のない標準UUID実装`14.0.2`は、実際に使うTypeScript参照パッケージへ固定しています。ルートとTypeScript参照パッケージの依存関係検査は、どちらも既知の脆弱性0件です。GitHub上で警告が閉じることは、修正を`main`へ統合した後に別途読み戻します。

```sh
npm run validate:void
npm run build:void:static
```

Voidの認証、プロジェクト接続、配置は未実施です。`npm run deploy:void:static`は、利用者が今後明示的に選ぶ配置操作として分離してあり、現在の公開成功は主張しません。この区別は[Quickstart](https://void.cloud/guide/quickstart)、[Agents integration](https://void.cloud/integrations/agents)、[CLI reference](https://void.cloud/reference/cli)の公式情報を根拠にしています。Devpostはホテル向けの提出内容を更新し、提出番号`1158722`で送信済みです。

機械可読の状態は[`metadata/void-integration.json`](../metadata/void-integration.json)で確認できます。導入済みと公開済みを同じ状態にはしません。

Devpostでは、[プロジェクトページ](https://devpost.com/software/project-y79pb23hj1mz)の画面題名と見出しを`Kyoto Booking Retry Proof`にし、京都のホテル二重予約防止に絞った説明、ChatGPT Sites、Vercel、公開リポジトリ、一般公開した[YouTube動画](https://youtu.be/tdSvJw4ghX8)を反映しました。版8で説明を153件のNode試験へ合わせ、版9で技術、リンク、動画を統一し、版10で冒頭の式、見出し、再送結果リスト、版11で60秒の四手順を整えました。提出後の匿名HTMLでは`og:title`も`Kyoto Booking Retry Proof`、`og:image`も[アップロード済みホテル画像](https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/005/194/459/datas/medium.png)になりました。提出番号`1158722`は`Submitted`で、送信応答と認証済みプロジェクト読み戻しの`submitted_at`は`2026-08-29T09:14:00.129-04:00`で一致しました。

YouTubeでは、`WebMCP vs Duplicate Bookings: A Live Demo`を一般公開しました。公開プレーヤーの表示時間は2分30秒です。アップロードと高精細処理は完了し、著作権検査は問題なしでした。英語音声と画面へ焼き込んだ英語字幕に加え、日本語字幕トラックも公開済みです。Canvaで選んだ専用サムネイルは端末内に準備済みですが、ブラウザーのファイル選択が失敗したため未反映で、現在はYouTubeが自動生成したサムネイルを使っています。この失敗から専用サムネイルの外部公開成功は推測しません。

ChatGPT Sitesでは、安全版依存を使う機能コミット`5ac1fe51a29800eb052f9a63e7311559b7c01e45`を版10へ配置し、新しい予約条件で準備、人間の画面操作による確定、安全な再送を実行しました。`PREPARED → COMMITTED → RETRY_RECOGNIZED`、2試行、架空予約1件、処理開始1回、WebMCP四機能、確認番号`FKR-7EF2A00FA2`を直接確認しています。最終状態を含む提供元報告コミット`f832cc611ed43613035a8735ca97d4bc1a0a8efc`は履歴外の観測として保持し、版12の現在チェックアウトと完全パッケージ要約値を再現境界として[一般公開URL](https://kyoto-booking-retry-proof.anionix.chatgpt.site)へ配置しました。提供元の版識別子は`appgprj_6a923239002081918896546134a7dc8f~appgver_feeff1aa402c8191a02e0945d9cdd04e`、配置識別子は`appgdep_6a92e425bbdc8191ac9ca35d524f61a0`です。匿名HTTP 200に加え、JavaScript、スタイルシート、サービスワーカー、サービス状態表が端末内成果物と一致しました。CloudflareがルートHTMLへ検査用スクリプトを追加するため、ルートHTMLのバイト一致は主張しません。版12の機能要約値は実操作済み版10と同一なので、実操作証拠を引き継ぎますが、版12で再実行したとは扱いません。

Vercelでは、機能コミットをホテル専用配置`dpl_4uthDyjgSi1KxbssW9t5u18xJbLs`へ配置し、新しい保存領域から同じ再送収束を実測しました。現行配置`dpl_ArJPwr1h3KqyxmRRfegcbX4YqTB2`は提供元がクリーン状態として報告した履歴外コミット`e3d3bb7ccc142a50a2a7af29dad4cd7bb449c4cb`を観測値として記録し、現在のチェックアウトの成果物要約値を再現境界として公開され、`2026-08-29T13:35:38.108Z`に`READY`となりました。[一般公開URL](https://kyoto-booking-retry-proof.vercel.app)と[配置固有URL](https://kyoto-booking-retry-proof-kafikuvr2-aniotajp-1978s-projects.vercel.app)から取得した五つのファイルは端末内成果物と一致し、`2026-08-29T13:37:06.000Z`の提供元読み戻しで警告・エラーはともに0件でした。機能要約値`06a753e5cd240eebd0663c57031a0993e87cbb87c7d61401eb220dbacd91e132`は実操作済みの直前配置と同一なので、その実操作証拠を引き継ぎます。現行配置で新しい実操作を行ったとは主張しません。正確な提供元識別子は[`metadata/vercel-hotel-deployment.json`](../metadata/vercel-hotel-deployment.json)へ分離し、Sites専用の配置記録を上書きしません。

配置操作の途中で、旧通知実演プロジェクトを誤って対象にしました。その本番別名は直ちに配置`dpl_3KTHTtZ5h8quDhviMTRo5GxBuUuE`へ復旧し、[従来URL](https://verifiable-offline-webmcp-agent-spe.vercel.app)の匿名HTTP 200応答と通知実演表示を確認しました。ホテル版と通知実演版は引き続き別プロジェクトです。

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
| Devpost | 導入済み・有効（4.0.1） | あり | はい | 対象外 |

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
| Devpost | `DRAFT_UPDATE` | `AUTHORIZED_BY_PLAN` | ホテル向け題名、説明、公開先、動画、60秒手順、提出回答を版11まで準備済み。画像関連付けは`INCONCLUSIVE` |
| Devpost | `FINAL_SUBMISSION` | `AUTHORIZED_BY_USER` | 利用者の「devpostも投稿まで行う」に基づき、提出番号`1158722`で送信済み |

`AUTHORIZED_BY_USER`は、利用者が対象操作を個別に明示許可した後にだけ使います。現在はChatGPT SitesとVercelの一般公開、YouTubeの一般公開、Devpostの最終送信に使っています。Devpostの下書き更新と提出パケット準備は、利用者が実装を指示した計画を根拠とする`AUTHORIZED_BY_PLAN`へ文書、台帳、スキーマ、検査を統一しました。`REQUIRES_SEPARATE_APPROVAL`と`OUT_OF_SCOPE`の操作は実行しません。

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
12. Vercelの成功表示が、専用プロジェクト、現行READY配置、匿名200応答、配信一致、機能要約値が同じ直前配置での実ブラウザー再送収束、旧通知配置の復元証拠と一致すること。

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
