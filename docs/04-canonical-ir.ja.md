---
title: "Canonical IR"
language: "ja"
stable_uuid_v5: "2e775a49-4557-52d0-81d8-ef9b2d80b8aa"
event_uuid_v7: "01a04291-b45d-73d4-80cf-de9d838db56b"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Canonical IR

同じ入力に対してTypeScriptとWolframが同じdecisionを返すため、すべての判定入力をCanonical IRへ正規化します。

\[
RawInput\xrightarrow{Normalize}CanonicalIR\xrightarrow{\delta}\{ALLOW,DENY,HUMAN,RECONCILE\}
\]

優先順位:

\[
DENY_{hard}>RECONCILE>HUMAN>DENY_{utility}>ALLOW
\]

原則:

- missing security fieldは`false`ではなく`DENY`。
- probabilityは0〜1のfloatではなくPPM整数。
- moneyはminor unit整数。
- Unicode、時刻、tool ID、field setを正規化。
- `>` と `>=` を実装間で混ぜない。

schema: [`schemas/canonical-ir.schema.json`](../schemas/canonical-ir.schema.json)

golden vectors: [`data/golden-vectors.json`](../data/golden-vectors.json)
