---
title: "WebMCP入力を乾式実行だけへ通す境界"
language: "ja"
stable_uuid_v5: "6981d5d4-7504-5ebe-aee0-4d0567e37d86"
event_uuid_v7: "01a048da-1889-777d-a11d-87d4f4bdefa0"
verified_event_uuid_v7: "01a048e8-9b29-7f4c-af71-32eaff3519be"
adapter_event_uuid_v7: "01a04904-ca9a-7fb0-ada5-b80ab8e02e6c"
generated_at: "2026-08-28T14:50:47.817Z"
verified_at: "2026-08-28T15:06:38.761Z"
updated_at: "2026-08-28T15:37:25.914Z"
version: "0.3.0-candidate"
status: "browser-verified"
browser_evidence: "CONFIRMED"
native_webmcp_conformance: "INCONCLUSIVE"
---

# WebMCP入力を乾式実行だけへ通す境界

## 目的

WebMCPから来た値を、そのまま通知内容やSQLiteへ入れません。三つの文字列だけへ厳格に投影し、合格した値も乾式実行までで止めます。

English purpose: Independently project WebMCP input into three literal notification fields and allow it to reach dry-run preview only.

## 一次仕様から分かること

- WebMCPは2026年8月26日付のCommunity Group草案であり、W3C標準ではありません。[SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)
- 草案の`registerTool()`は`inputSchema`をJSON文字列として保存します。一方、現在の命令型実行手順は受信JSONをJavaScriptの物体へ解析して`execute`へ渡すところまでで、JSON Schemaによる値検査の規範手順は含んでいません。[WebMCP Draft](https://webmachinelearning.github.io/webmcp/#modelcontext-interface)
- `tools`権限の既定許可先は`self`です。本デモはさらに`Permissions-Policy: tools=(self)`、相対URL、localhost APIの`Origin`一致検査を重ねます。[WebMCP Permissions policy integration](https://webmachinelearning.github.io/webmcp/#permissions-policy-integration)
- 草案の安全性文書も、複数の生成元をまたぐエージェント状態の危険を未解決項目として扱っています。[WebMCP Security and Privacy Questionnaire](https://github.com/webmachinelearning/webmcp/blob/main/security-privacy-questionnaire.md)

したがって、`inputSchema`は発見と説明の契約として残しつつ、実装側の投影器を安全性の正本にします。これは草案の不足を埋める設計判断であり、ブラウザー全体の適合を証明するものではありません。

草案の接続面はさらに[`src/typescript/webmcp/notification-adapter.js`](../src/typescript/webmcp/notification-adapter.js)へ隔離しました。画面は登録結果を表示するだけで、`document.modelContext`や`registerTool()`を直接呼びません。

## 入力契約

| 項目 | 条件 | 投影後 |
|---|---|---|
| 入力全体 | 配列ではない単純な物体 | 新しい凍結済み物体 |
| キー | `logicalOperationId`、`title`、`body`だけ | 同じ三項目だけ |
| プロパティ | 自分自身の列挙可能な通常値 | 読み取り関数や継承値なし |
| `logicalOperationId` | 1〜128文字、英数字と`._:@/-` | Unicode NFC、前後空白除去 |
| `title` | 1〜120 Unicode文字 | Unicode NFC、前後空白除去 |
| `body` | 1〜1000 Unicode文字 | Unicode NFC、前後空白除去 |
| Unicode | 対にならないサロゲート、制御文字、方向制御文字、非文字を禁止 | 正しい文字列だけ |

入力本文は「命令」ではなく通知へ表示する文字列として扱います。`innerHTML`へ入れず、WebMCPの戻り値にもタイトルや本文を反射しません。戻すのはUUIDバージョン5の`intentId`、対象、要約値、制御状態、外部効果状態、承認要否だけです。

入力来歴も通知本文とは別の厳格な契約にします。`WEBMCP / LOCAL_FORM`は常に`UNTRUSTED`、内部の型付き呼び出しだけを`TRUSTED_INTERNAL`とし、生成元と未信頼の印はサーバー経路から作ります。要求本文から来歴項目を受け付けないため、外部入力が内部入力を名乗れません。詳しい型と読み戻し条件は[`16-webmcp-provenance-adapter.ja.md`](16-webmcp-provenance-adapter.ja.md)にあります。

## 状態と不変条件

```text
受信 -> 厳格検査 -> 乾式実行だけ
          |
          +-> 拒否 -> Intentを作らず停止
```

入力検査で拒否した場合の不変条件は次です。

\[
Reject(x) \Rightarrow
\Delta InputFields = \Delta Intent = \Delta Audit = \Delta Effect = 0
\]

新しい論理操作を受理した場合は、次の状態を独立に読み戻します。

\[
Accept(x) \Rightarrow Control=DRY\_RUN \land Effect=NOT\_STARTED
\]

ネットワーク切断などで乾式実行の結果を読み戻せない場合は成功表示にせず停止します。乾式実行がサーバーへ届いたかは不明になり得ますが、通知権限と外部効果の経路は呼んでいないため、実通知は開始しません。

## 権限境界

- WebMCP callbackから呼べるHTTP経路は`/api/preview`だけです。
- `Notification.requestPermission()`、`/api/approve-and-claim`、Service Workerの`showNotification()`は、乾式実行後に利用者が画面の承認ボタンを押した経路にだけあります。
- `exposedTo`は空配列で登録し、同一生成元の既定範囲を広げません。
- WebMCP未対応または登録拒否のブラウザーでは、ローカルの型付き画面を維持し、対応状況を`INCONCLUSIVE`と表示します。

## 自動検証

- 正規化後の凍結三項目だけが返る。
- 余分なキー、継承値、Symbol、読み取り関数、型違い、欠落、未対応識別子を拒否する。
- 壊れたUnicode、制御文字、方向制御文字、非文字、長さ超過を拒否する。
- JSON Schemaと実行時投影器の項目契約が一致する。
- 拒否後のSQLite Intent、外部効果開始件数、監査記録がすべて0のままである。
- 受理後は`DRY_RUN / NOT_STARTED`で、外部効果開始件数が0である。
- WebMCP callback内に通知権限要求がなく、戻り値へ本文を反射しない。
- WebMCP草案への参照が専用アダプター以外にない。
- 外部入力の来歴がサーバー側で生成され、SQLiteと監査記録から同じ値を読み戻せる。
- 同一論理操作を別経路から再要求しても、最初の来歴と同じIntent IDを保持する。
- 異なる生成元はIntent作成前に拒否する。

## ブラウザー観測

- Codex内蔵ブラウザーの`1440 x 1000`で、`notify_once`が同一生成元`http://127.0.0.1:4174`から、三項目のJSON Schemaとともに登録されたことを読み戻しました。
- 正常入力では、`Cafe`と結合アクセントを`Café`へ正規化し、画面の三節点が「受信」「厳格検査」「乾式実行だけ」の成功状態になりました。
- 正常入力の結果は`DRY_RUN / NOT_STARTED`、SQLite外部効果開始件数0、監査2件、監査鎖正常でした。WebMCP応答は識別子、要約値、状態、承認要否だけで、タイトルと本文を含みませんでした。
- 未知の`execute`項目を加えた呼び出しは`UNKNOWN_FIELD`で拒否され、入力欄と現在のIntentは不変でした。拒否対象のUUIDバージョン5 Intentは404、外部効果開始件数0、監査件数は2のままでした。
- 拒否状態は「厳格検査」を赤、「乾式実行だけ」を停止線で表示し、「Intentを作らず停止」と明記しました。
- 幅`390`、高さ`844`では三節点が一列へ折りたたまれ、文書幅と表示幅はともに`390`で横はみ出しはありませんでした。
- 意味構造では主要部1、名前付き入力境界領域1、ボタン4、状態出力1を識別でき、警告・エラーログは0件でした。
- この確認では承認ボタン、通知権限要求、通知アダプターを呼んでおらず、実通知は表示していません。

公開できる数値と監査鎖は[`metadata/webmcp-input-boundary-verification.json`](../metadata/webmcp-input-boundary-verification.json)と[`data/audit/webmcp-input-boundary-events.ndjson`](../data/audit/webmcp-input-boundary-events.ndjson)に保存します。

専用アダプターと来歴読み戻しの追加観測は[`metadata/webmcp-provenance-verification.json`](../metadata/webmcp-provenance-verification.json)と[`data/audit/webmcp-provenance-events.ndjson`](../data/audit/webmcp-provenance-events.ndjson)に保存します。

対象ブラウザー全体のネイティブWebMCP適合、キャンセル競合のすべて、複数生成元をまたぐエージェント実装の安全性は、引き続き`INCONCLUSIVE`です。
