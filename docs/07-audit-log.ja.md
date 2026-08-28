---
title: "暗号学的監査ログ"
language: "ja"
stable_uuid_v5: "16805e3a-321f-5feb-b61b-fb92b6520a61"
event_uuid_v7: "01a04291-b463-7182-85f9-ea672e0ff16e"
generated_at: "2026-08-27T09:34:00Z"
version: "0.1.0"
status: "design-specification"
---

# 暗号学的監査ログ

Event sourcingでは、現在状態はイベント列のprojectionです。

\[
S_n=Fold(Apply,S_0,[E_1,\ldots,E_n])
\]

イベントはcanonical JSON、SHA-256 chain、Ed25519署名、Merkle checkpointで束ねます。

\[
d_i=H(0x00\parallel C(E_i^{core}))
\]

\[
h_i=H(0x01\parallel h_{i-1}\parallel d_i\parallel Encode(i))
\]

\[
\sigma_i=Sign_{sk}(Domain\parallel logID\parallel deviceID\parallel seq_i\parallel h_i)
\]

JCS、SHA-256、Ed25519、Merkle treeの一次仕様: [SRC-RFC8785](source-map.md#src-rfc8785) [SRC-FIPS180-4](source-map.md#src-fips180-4) [SRC-RFC8032](source-map.md#src-rfc8032) [SRC-RFC9162](source-map.md#src-rfc9162)

注意: 暗号ログは「何が記録されたか」を保護しますが、物理的真実そのものを保証しません。だからEvidence Engineが別に必要です。
