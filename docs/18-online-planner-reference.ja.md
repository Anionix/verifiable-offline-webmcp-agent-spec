---
title: "任意オンライン計画器の参照実装"
language: "ja"
stable_uuid_v5: "ef19e408-94a3-5da8-ab61-57bafbf546e9"
event_uuid_v7: "01a0493d-49c2-7272-aa78-9c1aa9db1e1f"
generated_at: "2026-08-28T16:39:08.482Z"
version: "0.5.0"
status: "reference-implementation"
---

# 任意オンライン計画器の参照実装

## 何のためのものか

オンラインの言語モデルに「次に使う道具と引数の候補」を考えさせる境界です。ただし、モデルは承認を作れず、通知などの外部効果も開始できません。通信できない場合はオンライン経路だけを外し、ローカル機能を残します。

```text
ローカル機能
    ↓ 常に残す
事前制御 ── 不成立 ──> LOCAL_READY または STOPPED
    ↓ 成立
上限つき要求を1回
    ↓
UNTRUSTED_PROPOSAL
    ⊣ 承認なし / 外部効果なし / 自動再試行なし
```

WebMCPはブラウザー内で利用可能な道具を発見・実行する面、Responses APIはオンライン時だけ候補を作る面です。実行権限を持つローカル処理の集合を (E)、計画器へ見せる集合を (P) とすると、必ず次を満たします。

\[
P \subset E
\]

さらに、本参照実装の各 (p \in P) は `proposalOnly=true`、`createsAuthorization=false`、`startsExternalEffect=false` です。

## 通信前に止める条件

[`policy.ts`](../src/typescript/planner/policy.ts)は、次の順で候補経路を絞ります。

1. オンライン計画が明示的に有効か。
2. ネットワークを利用できるか。
3. 道具が許可一覧にあり、現在実行可能で、候補作成専用か。
4. 入力形が厳格で、未知の項目を拒否し、全項目を必須にしているか。
5. 必須情報がすべて`PUBLIC`か。個人情報と秘密は除外する。
6. 公開扱いの値にも電子メール、電話番号、認証文字列、秘密鍵らしい文字列がないか。
7. 信頼済み料金表から求めた最悪費用が上限以下か。

必要な非公開情報がある場合、または料金を計測できない場合は通信前に停止します。監査記録へ残すのは情報の値ではなく、公開した項目名と入力・要求のSHA-256要約値です。

## 費用の上限

現在の本番料金を固定値として埋め込みません。運用者がモデル名、観測時刻、有効期限、入力・出力100万トークン当たりの料金を指定し、信頼済みとした場合だけ計算します。期限切れの料金表は未計測として停止します。

\[
C_{max}=\left\lceil\frac{B_{request}R_{in}}{10^6}\right\rceil+
\left\lceil\frac{T_{out,max}R_{out}}{10^6}\right\rceil
\]

- (B_{request}): 正規化した要求のUTF-8バイト数。入力トークン数の保守的な上限として使う。
- (T_{out,max}): 設定した最大出力トークン数。
- (R_{in},R_{out}): 100万トークン当たりのマイクロ米ドル料金。

料金表がない、モデル名が一致しない、値が未信頼、または (C_{max}) が予算を超える場合は送信しません。返答に使用量がある場合も再計算し、超過時は候補を採用しません。本参照実装の料金値は模擬値であり、現在の本番料金は`UNMEASURED`です。

## Responses要求の境界

公開する要求例は[`request.sample.json`](../examples/online-planner-demo/request.sample.json)です。

- `store=false`
- `background=false`
- `parallel_tool_calls=false`
- `tool_choice.type=allowed_tools`
- 各関数道具は`strict=true`かつ`additionalProperties=false`
- 出力数と待ち時間に上限を置く

これらはOpenAIの[Responses作成仕様](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)と[関数呼び出しガイド](https://developers.openai.com/api/docs/guides/function-calling)を参照して固定しています。実際の認証情報を扱う通信処理は実装しておらず、実サービスへの適合は`INCONCLUSIVE`です。

## 返答を信用しない

返答は次をすべて満たす場合だけ`UNTRUSTED_PROPOSAL`になります。

- 応答状態が`completed`。
- 関数呼び出しがちょうど1件。
- 道具名が送信時の許可集合に含まれる。
- 呼び出し識別子が限定文字と長さの条件を満たす。
- 引数がJSONとして読め、送信時と同じ厳格な入力形に一致する。
- 観測費用が上限内。

候補には常に`authorization=NOT_CREATED`と`externalEffectStarts=0`が付くため、別の承認・実行処理が明示的に判断するまで何も起こりません。

## 故障時の扱い

時間切れ、応答消失、未完了応答、未知の道具、余分な引数、複数呼び出しはすべて`STOPPED`です。同じ要求を自動再試行しません。これは「返答が見えなかっただけで処理されたかもしれない」という曖昧さを、二重実行へ変えないためです。

## 実測した範囲

[`metadata/online-planner-verification.json`](../metadata/online-planner-verification.json)は13のローカル模擬経路をまとめます。

| 観測値 | 結果 |
|---|---:|
| 未承認の候補 | 1 |
| 作られた承認 | 0 |
| 外部効果開始 | 0 |
| 自動再試行 | 0 |
| 実ネットワーク要求 | 0 |
| 実サービス費用 | 0 |

生成物は二度作っても同じバイト列になり、独立したPython検証がJSON Schema、UUIDv5/v7と時刻、要求の最小化、許可道具、監査ハッシュ鎖、公開証拠の要約値を照合します。本番の品質と現在料金は`UNMEASURED`、実Responses API適合は`INCONCLUSIVE`です。
