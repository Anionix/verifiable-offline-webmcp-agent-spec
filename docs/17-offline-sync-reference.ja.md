---
title: "二端末オフライン同期の参照実装"
language: "ja"
stable_uuid_v5: "e727e987-bcc8-57f9-969e-ea948c911c71"
event_uuid_v7: "01a04925-51f4-7188-8129-b7140d163c63"
generated_at: "2026-08-28T16:12:57.716Z"
version: "0.4.0-candidate"
status: "reference-implementation"
---

<!-- information_uuid_v5=133e9b91-5738-5e1c-8bcd-567a65bba243 event_uuid_v7=01a04a5f-6d38-7fc8-89b3-1e7daabc661d state_transition=REVIEW -> EXECUTING occurred_at=2026-08-28T21:56:03.000Z machine-contract=SQLite key material is accepted only when its normalized digest matches the external trust anchor -->
<!-- information_uuid_v5=5873e905-b4fe-5cbf-b23e-e92d10068f7b event_uuid_v7=01a04c90-aedf-7a0d-bb62-fe99a19ae1c3 state_transition=REVIEW -> EXECUTING occurred_at=2026-08-29T08:09:05.503Z machine-contract=Only the externally bound first retained checkpoint may omit its signed parent; every interior parent remains mandatory -->
<!-- information_uuid_v5=542c5141-881b-506e-af3b-fa3f25439622 event_uuid_v7=01a04c90-aee0-7b99-9581-fa55957b08f4 state_transition=REVIEW -> EXECUTING occurred_at=2026-08-29T08:09:05.504Z machine-contract=Concurrent trust updates serialize reread merge and atomic replacement so the durable result is the union -->
<!-- information_uuid_v5=adafdf1a-7adc-5cc3-948f-b87cc011e114 event_uuid_v7=01a04c90-aee1-7e37-a797-81c25dc4b222 state_transition=REVIEW -> EXECUTING occurred_at=2026-08-29T08:09:05.505Z machine-contract=Legacy trust migration requires a complete external key set matching every stored identity and never trusts database keys alone -->

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
| `LocalSyncLedger` | SQLite外で固定した公開鍵要約値、登録済み公開鍵、署名付き出来事 | 信頼鍵台帳、全体取込順序、安全なタグ、人の確認待ち、隔離記録 | 通知、支払い、予約、削除の実行 |
| 読取専用デモ | 公開済みJSONとJSON Lines | 画面表示だけ | 承認、実行、変更、秘密鍵読取 |

同期役の公開操作は、端末公開鍵の登録、署名付き一式の取込、読み戻し、検証だけです。端末公開鍵の登録は信頼を追加する操作なので、SQLiteから鍵を自動採用しません。正規化した公開鍵のSHA-256要約値を別ファイルへ先に固定し、以後はSQLite内の鍵と毎回照合します。通知アダプターを引数に取る経路も、`execute`や`notify`という実行操作もありません。

複数の同期台帳が同じ信頼鍵ファイルを更新する場合は、排他用ディレクトリを一つだけ作成できた処理が、信頼鍵ファイルを読み直し、追加分を統合し、一時ファイルから原子的に置き換えます。待機期限を超えた更新は失敗させます。古い一覧を持つ別の台帳が後から書いても、すでに固定した鍵を消せません。

放棄された排他ディレクトリーを回収するときは、観測したデバイス番号・inode番号と所有者事象を削除対象へ結び付けます。削除直前にその値を再確認し、回復要求を先に予約して正規ロック名をフェンスしたまま、対象を一意な隔離名へ原子的に移してから、隔離先の実体が一致した場合だけ削除します。待機中に同じ名前へ新しい回復要求や生存中の本体ロックが置かれた場合は、隔離した要求を戻して所有者を残します。所有者のPIDが存在してもプロセス開始識別子が一致しない場合だけ回収し、開始識別子を取得できない別プロセスは安全側で回収しません。

外部の信頼鍵ファイルが存在しない旧台帳は、そのままでは起動に失敗します。移行時は`legacyTrustMigration`へ、全登録端末のUUIDバージョン5識別子と外部で確認した公開鍵を明示的に渡します。入力がSQLite内の端末、ログ、鍵の識別子と正規化公開鍵へ完全一致し、全登録端末を過不足なく覆う場合だけ、信頼鍵ファイルを作成します。SQLite内の公開鍵だけから信頼を作る経路はありません。

この境界が防ぐのは、SQLiteだけを書き換えられる実行者による鍵・出来事・チェックポイントの一括差し替えです。別ファイルの信頼鍵台帳まで変更できる実行者への耐性は未実装であり、本番ではオペレーティングシステムの鍵保管庫や署名済み設定へ置き換える必要があります。

## 端末側の証拠

各出来事は次を持ちます。

- 情報を追うUUIDバージョン5: 端末、端末ログ、鍵、論理操作
- 時系列を追うUUIDバージョン7: 出来事、チェックポイント
- RFC 3339時刻とミリ秒整数
- 端末内連番と直前の鎖ハッシュ
- 正規化JSONのSHA-256要約値
- 鍵識別子を結び付けたEd25519署名

チェックポイントは、出来事件数、Merkle root、鎖の先頭、直前チェックポイント要約値を署名します。実装根拠は、Ed25519の[RFC 8032](https://www.rfc-editor.org/rfc/rfc8032)、JSON正規化の[RFC 8785](https://www.rfc-editor.org/rfc/rfc8785)、UUIDの[RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)、追記ログの検査方法を示す[RFC 9162](https://www.rfc-editor.org/rfc/rfc9162)です。RFC 9162の証明方法を技術根拠にしていますが、証明書透明性サービスへの適合は主張しません。

初回同期で端末の最新チェックポイントだけを受け取る場合、そのチェックポイントが署名した直前要約値は同期側にまだありません。この一回だけは、受理したチェックポイント自身の要約値をSQLite外の信頼鍵ファイルへ固定し、検証鎖の開始境界にします。次のチェックポイントからは、直前チェックポイントが必ず同期台帳内に存在しなければなりません。途中の親を削除した場合は、署名、Merkle root、出来事鎖が個別に正しくても全体検証を失敗させます。

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
| 初回境界ではないチェックポイントの親欠落 | `SIGNED_DEVICE_CHAIN_MISMATCH` | 0 |
| 信頼鍵ファイルなしの旧台帳を移行入力なしで起動 | 起動失敗 | 0 |
| SQLite内の公開鍵を署名済み記録ごと差し替え | `TRUST_ANCHOR_MISMATCH` | 0 |

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
