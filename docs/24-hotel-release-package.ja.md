# 京都ホテル二重予約防止デモの配布物

<!-- information_uuid_v5=55e8dd64-ba47-5c26-897d-aa6893eb5ec5 -->
<!-- event_uuid_v7=01a04dbb-0fa0-7ce4-a7b3-ec9f7ab149f3 state_transition=UNPACKAGED_HOTEL_ARTIFACT -> REPRODUCIBLE_RELEASE_CONTRACT_IMPLEMENTED occurred_at=2026-08-29T13:35:00.000Z -->
<!-- event_uuid_v7=01a0573d-8e18-7534-9480-d5f1b43c54d0 state_transition=REPRODUCIBLE_RELEASE_CONTRACT_IMPLEMENTED -> PUBLIC_TARGETS_AND_DESCRIPTION_ALIGNED occurred_at=2026-08-31T09:54:07.000Z machine-contract=Current Sites, Vercel, and Devpost alignment is recorded separately from the package build. -->
<!-- machine-contract: 同じ確定済みコミットと同じ構築道具から、同じ並びのファイル集合と同じSHA-256一覧を作る。 -->

`npm run release:hotel`は、既存のホテル画面とChatGPT Sites用成果物を構築して検査した後、`release/kyoto-booking-retry-proof/`へ再現可能なファイル集合を作ります。審査者が最初に読む英語主表示のREADME、英日二つの視覚導線、英語の再現手順を専用ファイルとして収録します。配布物を`dist/`の外へ分けるため、ChatGPT Sites包装へ混ざりません。`release/`はGitの追跡対象外です。

現在の公開版対応は、提出先ChatGPT Sites版14（ソース`2fbbf1b714ca660ef1681239b638205a9835f7c5`）、Vercel本番配置`dpl_BetejQ7wQwwouGcyC6HW588EiqK8`（ソース`adeaf3f549aa7379acacbc6960eae4c11bbc6ba2`）、Devpost版14を別々に読み戻した[`公開版対応表`](../metadata/public-release-alignment-readback.json)で確認します。三つの評価は194件と四機能で一致します。ネイティブWebMCPの新しい実行は同じVercel配置の一意な別名で行い、結果は別の実測記録に保存しています。外部効果は測定していません。

実行には、Git、依存関係を導入済みのNode.js 24.15、`python3`、Gitleaksが必要です。Gitleaksは配布物の秘密情報検査に使います。macOSでは`brew install gitleaks`、それ以外は[Gitleaksの公式導入手順](https://github.com/gitleaks/gitleaks#installing)を使い、先に`gitleaks version`が成功することを確認してください。未導入なら、構築を始める前に具体的な導入方法を表示して停止します。

- `README.md`: 60秒の審査手順と短い日本語要約
- `DEVPOST_VISUAL_GUIDE.md`: 10秒・60秒・150秒の英語主視覚導線と6枚の画面契約
- `DEVPOST_VISUAL_GUIDE_JA.md`: 6枚の画面と短い日本語順序
- `RELEASE_GUIDE.md`: 英語の構築・要約値検査手順
- `release-manifest.json`: 元コミット、公開先、三つの成果物要約値、60秒の試し方
- `SHA256SUMS`: 目録を含む全配布ファイルのSHA-256

実行前に、作業場所を一つの確定済みコミットへ揃え、未確定の差分をゼロにしてください。配布処理は未確定の差分がある場合に停止します。

```bash
npm run release:hotel
npm run validate:hotel:release
cd release/kyoto-booking-retry-proof
shasum -a 256 -c SHA256SUMS
```

配布ディレクトリには`dist/client/**`、`dist/server/**`、`dist/.openai/**`、専用の4文書、Apache License 2.0の`LICENSE`、機械可読の`release-manifest.json`、`SHA256SUMS`だけが入ります。動画本体と環境設定ファイルは名前で拒否し、完成した配布物へGitleaksを実行します。個人情報を意図して収録せず、動画は一般公開URLだけを記録します。

この配布物検査は、安全なリンク追従なしのファイルオープンを保証できないためWindowsでは利用できません。これはブラウザーデモ本体とは別の制限です。

<!-- machine-contract information_uuid_v5=4f18aaff-864b-5bbd-a2ce-1c33f0add5f2 event_uuid_v7=01a054f1-6b9b-7d84-8a31-53a43a4a52a0 state_transition=PER_OPERATION_HELPER_STARTUP -> ONE_BOUND_ROOT_HELPER_PER_VALIDATION occurred_at=2026-08-30T23:11:43.003Z -->
Pythonの補助処理は、検査ごとに一度だけ起動します。三回の一覧確認でも同じ補助処理を使い、読み取りのたびに親フォルダーの識別子を照合します。要求は一件ずつ送り、通し番号と返却バイト数が一致しなければ拒否します。各要求と最後の終了待ちはそれぞれ5秒以内、検査全体は従来どおり30秒以内です。異常時は成功を返さず、補助処理の終了後に配布フォルダーの参照を閉じます。

この読み取り方法の再現にはNode.js 24.15と`python3`を使います。macOSとLinuxでは、配布フォルダーを一度開き、その同じフォルダーを確認しながら配下の項目を読みます。Pythonの補助処理へ渡すのは、開いたフォルダーの識別子と検査済みの相対位置だけです。リンクはたどらず、1ファイルは8 MiBまで、1回の一覧は4,096件まで、配布物全体の一覧は4,096件まで、検査時間は30秒までです。配布フォルダーより上の親フォルダーは信頼できることが前提です。途中の差し替えを検出しますが、検査全体を一瞬の状態として固定する保証ではありません。根拠は[Node.js v24.15 fs](https://nodejs.org/download/release/v24.15.0/docs/api/fs.html)、[Node.js child_process stdio](https://nodejs.org/download/release/v24.15.0/docs/api/child_process.html#optionsstdio)、[Python os.listdir](https://docs.python.org/3.14/library/os.html#os.listdir)です。

JSONは、元コミット、コミット時刻、UUIDv5、決定的UUIDv7、機能部分・全クライアント・全Sites包装の三つのSHA-256要約値、公開先、YouTube動画、60秒の四手順、各内容ファイルの大きさとSHA-256を記録します。`SHA256SUMS`はJSON目録自身も検査しますが、自分自身は列挙しないため、自己参照による要約値の循環はありません。

同じコミットで再生成した二つの要約値一覧が一致することは、次で確認できます。

```bash
npm run release:hotel
cp release/kyoto-booking-retry-proof/SHA256SUMS /tmp/kyoto-booking-retry-proof.first.sha256
npm run release:hotel
cmp /tmp/kyoto-booking-retry-proof.first.sha256 release/kyoto-booking-retry-proof/SHA256SUMS
```

審査で迷ったら、配布物の`README.md`を開いてください。画面の順番は[英語の視覚導線](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.en.md)、日本語の短い要約は[日本語の視覚導線](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.ja.md)です。
