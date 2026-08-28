---
title: "セキュリティ・プライバシー"
language: "ja"
stable_uuid_v5: "57a14140-9f97-5b3e-9c25-0622646a2472"
event_uuid_v7: "01a04291-b46b-78f5-8b28-2000dfd44d71"
online_planner_event_uuid_v7: "01a04948-c160-73e4-b2f6-506ad19726a2"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# セキュリティ・プライバシー

## 脅威

- prompt/tool/page injection
- privilege amplification
- forged or expired approval
- duplicate side effect
- ambiguous retry
- audit rewrite/truncation/fork
- sensitive-data overcollection
- offline replay under stale policy
- supply-chain/schema drift

## 統制

1. LLM outputはuntrusted proposal。
2. critical capabilityはplannerへ非公開。
3. approval tokenをnormalized intent digestへbind。
4. `AMBIGUOUS`中のmutation禁止。
5. secret/private keyをmodel contextへ入れない。
6. auditはdigest/reference中心、PII blobは分離・暗号化。
7. logをhash chain + signature + external checkpointで保護。
8. missing security dataはfail closed。
9. productionではkey rotation、revocation、attestation、retention policyを追加。

WebMCP草案もtool metadata/contentからのagent操作をsecurity concernとして扱います。 [SRC-WEBMCP-2026](source-map.md#src-webmcp-2026)

## 任意オンライン計画器の追加統制

- オンライン利用は既定で無効にし、無効時と通信不能時もローカル経路を維持する。
- 計画器へ見せる道具は、許可済み、実行可能、候補専用、承認作成なし、外部効果なしをすべて満たすものだけにする。
- 必須の非公開情報がある場合は送信せず停止する。任意の個人情報・秘密は除外する。
- 公開扱いの値も、電子メール、電話番号、認証文字列、秘密鍵らしい形を検出したら停止する。
- 監査記録には入力値や候補引数を保存せず、要約値、項目名、状態、停止理由だけを保存する。
- 料金が`UNMEASURED`、上限超過、時間切れ、応答消失、未完了または不正な返答の場合は停止し、自動再試行しない。
- 候補は承認ではない。`authorizationCreated=0`と`externalEffectStarts=0`を機械契約と公開証拠の両方で照合する。
