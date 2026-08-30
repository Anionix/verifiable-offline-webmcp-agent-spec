# 京都ホテル二重予約防止デモの配布物

<!-- information_uuid_v5=55e8dd64-ba47-5c26-897d-aa6893eb5ec5 -->
<!-- event_uuid_v7=01a04dbb-0fa0-7ce4-a7b3-ec9f7ab149f3 state_transition=UNPACKAGED_HOTEL_ARTIFACT -> REPRODUCIBLE_RELEASE_CONTRACT_IMPLEMENTED occurred_at=2026-08-29T13:35:00.000Z -->
<!-- machine-contract: 同じ確定済みコミットと同じ構築道具から、同じ並びのファイル集合と同じSHA-256一覧を作る。 -->

`npm run release:hotel`は、既存のホテル画面とChatGPT Sites用成果物を構築して検査した後、`release/kyoto-booking-retry-proof/`へ再現可能なファイル集合を作ります。審査者が最初に読む英語主表示のREADME、英日二つの視覚導線、英語の再現手順を専用ファイルとして収録します。配布物を`dist/`の外へ分けるため、ChatGPT Sites包装へ混ざりません。`release/`はGitの追跡対象外です。

実行には、Git、依存関係を導入済みのNode.js、Gitleaksが必要です。Gitleaksは配布物の秘密情報検査に使います。macOSでは`brew install gitleaks`、それ以外は[Gitleaksの公式導入手順](https://github.com/gitleaks/gitleaks#installing)を使い、先に`gitleaks version`が成功することを確認してください。未導入なら、構築を始める前に具体的な導入方法を表示して停止します。

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

JSONは、元コミット、コミット時刻、UUIDv5、決定的UUIDv7、機能部分・全クライアント・全Sites包装の三つのSHA-256要約値、公開先、YouTube動画、60秒の四手順、各内容ファイルの大きさとSHA-256を記録します。`SHA256SUMS`はJSON目録自身も検査しますが、自分自身は列挙しないため、自己参照による要約値の循環はありません。

同じコミットで再生成した二つの要約値一覧が一致することは、次で確認できます。

```bash
npm run release:hotel
cp release/kyoto-booking-retry-proof/SHA256SUMS /tmp/kyoto-booking-retry-proof.first.sha256
npm run release:hotel
cmp /tmp/kyoto-booking-retry-proof.first.sha256 release/kyoto-booking-retry-proof/SHA256SUMS
```

審査で迷ったら、配布物の`README.md`を開いてください。画面の順番は[英語の視覚導線](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.en.md)、日本語の短い要約は[日本語の視覚導線](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.ja.md)です。
