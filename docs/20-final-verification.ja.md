---
title: "1.0.0 最終公開検証"
language: "ja"
stable_uuid_v5: "db952d34-9bf6-5b96-b77b-b3bfd0ba077f"
event_uuid_v7: "01a049d1-b7e1-7443-a30b-4620165c8b17"
updated_at: "2026-08-28T19:21:16.001Z"
version: "1.0.0-candidate"
status: "ready-for-public-readback"
---

# 1.0.0 最終公開検証

> **本質:** 二重送信防止は二つの有限状態検査で違反0。67件の検証記録はすべて実装済み・自動確認あり。WebMCPは限定した道具発見だけ確認できたので、ブラウザー全体の対応状況は`INCONCLUSIVE`のままにする。

## 一枚で見る

```text
同じ論理操作
      │
      ▼
  永続台帳 ── 既存の外部効果あり ──► 再送しない
      │
      └── 結果不明 ──► 照合 ──► 存在確認 ──► 再送しない

検証の読み合わせ
  独立した有限状態探索  38状態 / 違反0
              ║ 一致
  TLA+ TLC             38状態 / 違反0
              ║
  67件の検証台帳       実装67 / 自動確認67
```

## ブラウザー実測

| 観測場所 | 標準の`document.modelContext` | ブラウザーが仲介する道具発見 | 判定 |
|---|---:|---:|---|
| 自動検証用Chromium 152 | なし | 未観測 | この環境では不在 |
| 接続中のChrome | なし | なし | 読み取り可能な範囲では不在 |
| Codexアプリ内ブラウザー | なし | `notify_once`あり | 限定した道具発見は確認済み |

アプリ内ブラウザーで見えた`notify_once`は、厳格な三入力から乾式実行の通知予定を作る道具である。通知権限を要求せず、目に見える通知も作れない。実測ではこの道具を呼んでいない。

観測結果が混在しており、WebMCPはCommunity Groupの草案であるため、一般的なネイティブ対応と版は`INCONCLUSIVE`とする。個々の限定観測を、ブラウザー全体の適合へ格上げしない。

機械可読の元記録は[`data/final-verification-observations.json`](../data/final-verification-observations.json)、集約結果は[`metadata/final-verification.json`](../metadata/final-verification.json)にある。

## 形式検証

| 検査 | 今回の状態 | 結果 | 境界 |
|---|---|---:|---|
| Python有限状態探索 | 実行済み | 38到達状態、43遷移、禁止状態0 | 抽象モデルだけ |
| TLA+ Tools v1.7.4 / TLC 2.19 | 実行済み | 44生成、38相異状態、残り0、深さ13、違反0 | 抽象モデルだけ |
| Wolfram Language | 今回は実行環境なし | `NOT_EXECUTED` | 現在実行したとは主張しない |
| 既存Wolfram結果とPythonの厳密分数計算 | 照合済み | 確率質量1、再試行式一致 | 既存結果の確認 |

TLA+の実行ファイルはリポジトリへ含めない。公式リリースに掲載されたSHA-1と、取得した`v1.7.4`の`jar`を照合してから実行した。SHA-1は`bee4a54f3ee3d4afc347c3240ec2d9e93b075104`、取得物のSHA-256は`936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`である。詳細は[`formal/tla/verification-report.json`](../formal/tla/verification-report.json)に固定した。

## 67件と外部効果

```text
検証台帳      67
├─ 実装済み   67
├─ 自動確認   67
├─ 一部実装    0
└─ 仕様のみ    0

今回の実測
├─ WebMCP道具呼び出し        0
├─ 通知権限要求               0
├─ 実通知                     0
├─ 観測対象ページの外部通信   0
├─ 通知予定 / 試行 / 効果     0 / 0 / 0
└─ 監査イベント               0
```

これは既存の実通知証拠を消す意味ではない。今回の最終確認が、追加の通知や外部効果を起こしていないことを示す。

## 再現方法

通常の検証は追跡ファイルを書き換えない。

```bash
make validate
```

意図的に最終証拠を更新する場合だけ、差分を確認できる別コマンドを使う。

```bash
make evidence-final
```

公式の`v1.7.4`版`jar`を別途取得した環境では、TLCまで再実行できる。

```bash
make verify-tla TLA2TOOLS_JAR=/absolute/path/to/tla2tools.jar
```

## 公開後にだけ確定する項目

追跡中のJSONは、自分自身がまだ公開されていない段階で`main`の読み戻し成功や未解決の重大欠陥0を主張しない。次の三点は、pull request統合後にGitHub Issue #45へUUIDv5、UUIDv7、RFC 3339時刻、公開ハッシュと一緒に記録する。

- 公開`main`からの読み戻し
- pull requestの不具合コメントが未解決0件であること
- 秘密情報検査が0件であること

それまでは`READY_FOR_PUBLIC_READBACK`であり、完成扱いにしない。

## 一次情報

- [WebMCP Draft Community Group Report](https://webmachinelearning.github.io/webmcp/) — 草案の標準入口、道具登録、`tools`権限方針
- [TLA+公式リポジトリ](https://github.com/tlaplus/tlaplus) — TLCと公式配布の案内
- [TLA+ Tools v1.7.4公式リリース](https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4) — 実行ファイルと公開SHA-1
- [Specifying Systems and Verifying Specifications](https://lamport.azurewebsites.net/pubs/spec-and-verifying.pdf) — 状態遷移と不変条件の一次資料
