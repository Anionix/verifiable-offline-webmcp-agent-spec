---
title: "Canonical IR"
language: "en"
stable_uuid_v5: "c680e969-6680-5b37-a1e4-38e50a1e657d"
event_uuid_v7: "01a04291-b45e-751d-8af8-8b6cd17d760b"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# Canonical IR

All decision inputs normalize into one representation so TypeScript and Wolfram return the same decision:

\[
RawInput\xrightarrow{Normalize}CanonicalIR\xrightarrow{\delta}\{ALLOW,DENY,HUMAN,RECONCILE\}
\]

Rule precedence is `hard DENY > RECONCILE > HUMAN > utility DENY > ALLOW`. Missing security fields deny, probabilities are integer PPM, money is integer minor units, and comparison boundaries are identical across implementations.

See [`schemas/canonical-ir.schema.json`](../schemas/canonical-ir.schema.json) and [`data/golden-vectors.json`](../data/golden-vectors.json).
