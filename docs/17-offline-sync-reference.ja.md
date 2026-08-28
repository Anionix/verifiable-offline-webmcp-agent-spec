---
title: "二端末オフライン同期の参照実装"
language: "ja"
stable_uuid_v5: "e727e987-bcc8-57f9-969e-ea948c911c71"
event_uuid_v7: "01a04925-51f4-7188-8129-b7140d163c63"
generated_at: "2026-08-28T16:12:57.716Z"
version: "0.4.0-candidate"
status: "reference-implementation"
---

# 二端末オフライン同期の参照実装

## 本質

二台が通信切断中に別々の記録を作っても、再接続後に合わせてよいのは**追加だけできる安全な集合**です。通知、支払い、予約、削除のように現実へ一度きりの影響を与える意図は、自動統合も自動実行もせず、`HUMAN_REVIEW_REQUIRED`（人の確認待ち）へ止めます。

```text
端末Aの署名鎖 ─┐
                 ├─ 署名・連番・直前ハッシュを検証 ─┬─ 安全なタグ集合を統合
端末Bの署名鎖 ─┘                                    └─ 通知の意図を人の確認待ちへ隔離
```

今回の公開証拠は「通知の意図が二端末から2件、実通知は0件、人の確認待ちは1件」です。実通知を試す工程ではないため、新しい通知承認は要求していません。

## 責任と権限

| 部品 | 読めるもの | 書けるもの | 持たない権限 |
|---|---|---|---|
| `SignedDeviceLog` | 端末内の操作 | 端末内の署名付き出来事とチェックポイント | 他端末の台帳、通知実行 |
| `LocalSyncLedger` | 登録済み公開鍵、署名付き出来事 | 全体取込順序、安全なタグ、人の確認待ち、隔離記録 | 通知、支払い、予約、削除の実行 |
| 読取専用デモ | 公開済みJSONとJSON Lines | 画面表示だけ | 承認、実行、変更、秘密鍵読取 |

同期役の公開操作は、端末公開鍵の登録、署名付き一式の取込、読み戻し、検証だけです。通知アダプターを引数に取る経路も、`execute`や`notify`という実行操作もありません。

## 端末側の証拠

各出来事は次を持ちます。

- 情報を追うUUIDバージョン5: 端末、端末ログ、鍵、論理操作
- 時系列を追うUUIDバージョン7: 出来事、チェックポイント
- RFC 3339時刻とミリ秒整数
- 端末内連番と直前の鎖ハッシュ
- 正規化JSONのSHA-256要約値
- 鍵識別子を結び付けたEd25519署名

チェックポイントは、出来事件数、Merkle root、鎖の先頭、直前チェックポイント要約値を署名します。実装根拠は、Ed25519の[RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)、JSON正規化の[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)、UUIDの[RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)、追記ログの検査方法を示す[RFC 9162](https://www.rfc-editor.org/rfc/rfc9162)です。RFC 9162の証明方法を技術根拠にしていますが、証明書透明性サービスへの適合は主張しません。

証拠生成時の秘密鍵は処理内だけで作り、公開鍵と署名済み記録だけを保存します。本番端末の鍵保管庫との統合は`UNIMPLEMENTED`です。

## 同期側の処理

同期側は署名一式を検査した後、端末内連番を変えずに全体取込連番を追加します。全体取込記録も直前ハッシュを持つため、端末をまたいだ取込順序を再計算できます。来歴の表現は[PROV-O](https://www.w3.org/TR/prov-o/)を根拠にしています。

同じ端末内連番と同じ鎖ハッシュをもう一度受け取った場合は`DUPLICATE`として同じ結果を返し、全体連番を増やしません。同じ端末内連番に別の有効な鎖ハッシュが来た場合は`FORK_DETECTED`として隔離します。

安全な統合対象は、追加だけできるタグ集合に固定しました。集合の和は順序を入れ替えても、同じ値を繰り返しても結果が変わりません。根拠はShapiroほかの[Conflict-Free Replicated Data Types](https://hal.inria.fr/hal-00932836/document)です。これは通知のような外部効果を統合してよい根拠にはならないため、外部効果は別の型で閉じます。

## 故障試験

| 入力 | 停止結果 | 外部効果 |
|---|---|---:|
| 署名の改変 | `INVALID_SIGNATURE` | 0 |
| 端末内連番の欠け | `SEQUENCE_GAP` | 0 |
| 同じ端末内連番の別鎖 | `FORK_DETECTED` | 0 |
| チェックポイント不一致 | `CHECKPOINT_MISMATCH` | 0 |

`make validate`は、JSON Schema、公開鍵署名、端末内鎖、Merkle root、チェックポイント署名、全体取込鎖、出典出来事との結び付き、公開ファイル要約値、危険な意図2件から確認待ち1件への集約、実通知0件をTypeScriptとは別のPython実装でも読み戻します。

## 実行

```bash
make evidence-sync   # 追跡する公開証拠を意図的に更新
make validate        # 追跡ファイルを書き換えず検証
make demo-sync       # http://127.0.0.1:4174 の読取専用画面
```

主な公開証拠:

- [`metadata/offline-sync-verification.json`](../metadata/offline-sync-verification.json)
- [`data/audit/offline-sync-device-events.ndjson`](../data/audit/offline-sync-device-events.ndjson)
- [`data/audit/offline-sync-ingestion.ndjson`](../data/audit/offline-sync-ingestion.ndjson)
- [`data/audit/offline-sync-quarantine.ndjson`](../data/audit/offline-sync-quarantine.ndjson)

## 検証できた範囲と未計測

- 二つの論理端末を一つのMac上で分岐・再接続: `VERIFIED`
- 端末別署名鎖、署名済みチェックポイント、分岐検出: `VERIFIED`
- 安全な集合の順序非依存・重複非依存の収束: `VERIFIED`
- 危険な通知意図の自動実行なし: `VERIFIED`、実通知0件
- 遠隔通信路: `UNIMPLEMENTED`
- 二台の実機と不安定な実ネットワークでの品質: `UNMEASURED`
- 長期運用の流入率、処理率、待ち時間: `UNMEASURED`
- ネイティブWebMCPとの組合せ: `INCONCLUSIVE`
- 外部サービス費: 0円
- ローカル機器と開発時間の費用: `UNMEASURED`
