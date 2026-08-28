---
title: "WebMCP専用アダプターと入力来歴の読み戻し"
language: "ja"
stable_uuid_v5: "863bbade-f21a-5f1e-b0eb-7c965926de65"
event_uuid_v7: "01a04904-ca93-7529-bc52-710b6977819a"
verified_event_uuid_v7: "01a0490d-f64e-7aa1-bb90-b3b392194fb2"
generated_at: "2026-08-28T15:37:25.907Z"
verified_at: "2026-08-28T15:47:26.926Z"
version: "0.3.0-candidate"
status: "browser-verified"
browser_evidence: "CONFIRMED"
native_webmcp_conformance: "INCONCLUSIVE"
---

# WebMCP専用アダプターと入力来歴の読み戻し

## 目的

草案段階のWebMCP接続を一つの専用アダプターへ閉じ込め、外部入力の「未信頼」という印を、通知予定、SQLite、ハッシュ連鎖監査記録、画面まで失わず伝えます。

English purpose: Isolate the draft WebMCP surface behind one adapter and preserve server-derived, untrusted input provenance through durable readback.

## 一次仕様から決めた境界

- WebMCP草案は、登録道具の`origin`、`exposedTo`、`readOnlyHint`、`untrustedContentHint`を定義し、道具への過剰な引数、道具の説明汚染、出力による命令注入を安全上の論点として挙げています。[WebMCP Draft](https://webmachinelearning.github.io/webmcp/)
- 同草案の安全性調査は、同一生成元を既定の範囲としつつ、生成元をまたぐ状態共有の危険を未解決項目として残しています。[WebMCP Security and Privacy Questionnaire](https://github.com/webmachinelearning/webmcp/blob/main/security-privacy-questionnaire.md)
- Permissions Policyは、機能ごとに利用可能な生成元を制限する仕組みです。本デモは`tools=(self)`に加え、サーバー側で受信`Origin`を正規化済みのページ生成元と完全一致させます。[W3C Permissions Policy](https://www.w3.org/TR/permissions-policy/)

このため、`document.modelContext`と`registerTool()`へ触れるのは[`src/typescript/webmcp/notification-adapter.js`](../src/typescript/webmcp/notification-adapter.js)だけです。通知エンジン、画面、SQLiteはWebMCP草案の形を知りません。

## 契約

```text
外部のWebMCP入力
    -> 専用アダプター
    -> 三項目へ厳格投影
    -> サーバーが入力来歴を生成
    -> 乾式実行
    -> SQLiteと監査記録から読み戻す
```

入力来歴は、呼び出し側が自由に指定できる項目ではありません。サーバーの経路と正規化済み生成元から次を生成します。

| 項目 | WebMCP入力 | ローカル画面 | 内部処理 |
|---|---|---|---|
| 入力経路 | `WEBMCP` | `LOCAL_FORM` | `TYPED_INTERNAL` |
| 信頼状態 | `UNTRUSTED` | `UNTRUSTED` | `TRUSTED_INTERNAL` |
| 内容の印 | `UNTRUSTED_LITERAL` | `UNTRUSTED_LITERAL` | `INTERNAL_TYPED` |
| 生成根拠 | `SERVER_ROUTE` | `SERVER_ROUTE` | `LOCAL_PROCESS` |

同じ論理操作が別経路から再要求された場合も、最初に保存した入力来歴を上書きしません。通知予定の一意制約が同じUUIDバージョン5へ収束させ、SQLiteから最初の`intent-created`記録を読み戻します。

## WebMCP登録の意味

- `exposedTo: []`は同一生成元の既定範囲を広げない指定です。
- `readOnlyHint: false`は、実通知を出さなくても乾式実行がSQLiteと監査記録を更新するためです。
- `untrustedContentHint: false`は、道具の戻り値から未信頼の通知タイトルと本文を除外しているためです。未信頼の印そのものは`inputEvidence`として返します。
- WebMCP登録は通知権限を要求せず、通知を表示しません。実通知は画面上の直前承認だけから到達できます。

## 不変条件

入力来歴を`P`、永続読み戻しを`R(P)`、外部効果開始回数を`E`とします。

\[
Accept(P) \Rightarrow R(P)=P \land E=0
\]

\[
Duplicate(P_2) \Rightarrow R(P_2)=P_1 \land Intent(P_2)=Intent(P_1) \land E=0
\]

\[
Origin\neq ExpectedOrigin \Rightarrow \Delta Intent=\Delta Audit=\Delta Effect=0
\]

来歴が一致しない、読み戻せない、生成元が違う、未知の入力項目がある場合は成功表示にしません。

## ブラウザー観測

- Codex内蔵ブラウザーで`notify_once`、生成元`http://127.0.0.1:4175`、空の`exposedTo`、二つの注釈を登録結果から読み戻しました。
- WebMCP入力は`WEBMCP / UNTRUSTED / UNTRUSTED_LITERAL / SERVER_ROUTE`としてSQLiteと監査記録に残り、同じUUIDバージョン7の作成事象と内容が一致した場合だけ画面へ一致を返しました。
- 同じ論理操作をローカル画面から再要求しても、同じIntent IDを返し、最初のWebMCP来歴を保持しました。監査は2件、外部効果開始回数は0のままでした。
- 未知の`execute`項目と異なる生成元`https://attacker.example`はIntent作成前に拒否されました。
- 幅`1440 x 1000`と`390 x 844`で、入力経路、信頼状態、生成元、永続証拠を文章で表示し、横方向のはみ出しはありませんでした。
- この検証では承認ボタン、通知権限要求、通知アダプターを呼ばず、実通知は表示していません。

公開できる観測値は[`metadata/webmcp-provenance-verification.json`](../metadata/webmcp-provenance-verification.json)、監査鎖は[`data/audit/webmcp-provenance-events.ndjson`](../data/audit/webmcp-provenance-events.ndjson)に保存します。

対象ブラウザー全体のWebMCP適合、異なるWebMCP実装間の互換性、生成元をまたぐエージェント状態の安全性は`INCONCLUSIVE`です。
