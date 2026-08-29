# 京都ホテル二重予約防止デモの配布物

<!-- information_uuid_v5=55e8dd64-ba47-5c26-897d-aa6893eb5ec5 -->
<!-- event_uuid_v7=01a04dbb-0fa0-7ce4-a7b3-ec9f7ab149f3 state_transition=UNPACKAGED_HOTEL_ARTIFACT -> REPRODUCIBLE_RELEASE_CONTRACT_IMPLEMENTED occurred_at=2026-08-29T13:35:00.000Z -->
<!-- machine-contract: 同じ確定済みコミットと同じ構築道具から、同じ並びのファイル集合と同じSHA-256一覧を作る。 -->

`npm run release:hotel`は、既存のホテル画面とChatGPT Sites用成果物を構築して検査した後、`dist/release/kyoto-booking-retry-proof/`へ再現可能なファイル集合を作ります。`dist/`はGitの追跡対象外です。

- `release-manifest.json`: 元コミット、公開先、三つの成果物要約値、60秒の試し方
- `SHA256SUMS`: 目録を含む全配布ファイルのSHA-256

実行前に、作業場所を一つの確定済みコミットへ揃え、未確定の差分をゼロにしてください。配布処理は未確定の差分がある場合に停止します。

```bash
npm run release:hotel
cd dist/release/kyoto-booking-retry-proof
shasum -a 256 -c SHA256SUMS
```

配布ディレクトリには`dist/client/**`、`dist/server/**`、`dist/.openai/**`、`README.md`、Apache License 2.0の`LICENSE`、機械可読の`release-manifest.json`だけが入ります。動画本体、環境設定ファイル、秘密値、個人情報は入りません。動画は一般公開URLだけを記録します。

JSONは、元コミット、コミット時刻、UUIDv5、決定的UUIDv7、機能部分・全クライアント・全Sites包装の三つのSHA-256要約値、公開先、YouTube動画、60秒の四手順、各内容ファイルの大きさとSHA-256を記録します。`SHA256SUMS`はJSON目録自身も検査しますが、自分自身は列挙しないため、自己参照による要約値の循環はありません。

同じコミットで再生成した二つの要約値一覧が一致することは、次で確認できます。

```bash
npm run release:hotel
cp dist/release/kyoto-booking-retry-proof/SHA256SUMS /tmp/kyoto-booking-retry-proof.first.sha256
npm run release:hotel
cmp /tmp/kyoto-booking-retry-proof.first.sha256 dist/release/kyoto-booking-retry-proof/SHA256SUMS
```
