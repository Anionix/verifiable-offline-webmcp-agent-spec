# Changelog

<!-- information_uuid_v5=06f137fc-6ca9-5499-b447-b9cd9df976b5 event_uuid_v7=01a048c2-e3c4-7c0c-9abb-21b175b0719a state_transition=IMPLEMENTING -> BROWSER_VERIFIED occurred_at=2026-08-28T14:25:32.776Z -->
<!-- information_uuid_v5=34c13a76-73d8-5cf5-9fe1-fec1e071ba2f event_uuid_v7=01a04904-ca97-76f0-a4ed-56ea8c3ac507 state_transition=INPUT_PROJECTED -> PROVENANCE_READ_BACK occurred_at=2026-08-28T15:37:25.911Z -->
<!-- information_uuid_v5=7f1288b1-5d73-52a3-8a2c-8c686b5f568f event_uuid_v7=01a04925-5225-765c-93f3-c2b51a62ed94 state_transition=OFFLINE_DIVERGENCE -> VERIFIED_RECONNECT occurred_at=2026-08-28T16:12:57.765Z -->

## 0.4.0-candidate — 2026-08-29

- Added independent Ed25519-signed device chains with UUIDv7 events, device-local sequences, previous-hash links, Merkle roots, and signed checkpoints.
- Added a persistent SQLite synchronizer that keeps device order, assigns one global ingestion order, returns the same result for duplicate ingestion, and detects valid signed forks.
- Restricted automatic convergence to an add-only tag set; notification, payment, reservation, and deletion intents are stored only as `HUMAN_REVIEW_REQUIRED` cases.
- Added tampered-signature, missing-sequence, fork, checkpoint-mismatch, restart, duplicate, and order-independent convergence tests.
- Published public-key-only two-device evidence and an independent Python verifier for schemas, signatures, both hash chains, checkpoints, source links, and zero external-effect starts.
- Added a read-only responsive visualization showing two notification intents becoming zero notifications and one human-review case.
- Remote transport remains unimplemented, production multi-device quality is `UNMEASURED`, and native WebMCP integration remains `INCONCLUSIVE`.

## 0.3.0-candidate — 2026-08-28

- Added a state-driven visualization in which the initial request and same-operation retry converge on one SQLite-backed intent ledger.
- Added a measured external-effect count; values above one are disclosed as safety violations instead of being rounded to a successful result.
- Added automated checks for the one-effect invariant, ambiguous reconciliation, violation disclosure, status semantics, responsive layout, and reduced motion.
- Verified the dry-run screen at `1440 x 1000` and `390 x 844` without requesting another real notification; the narrow view had no horizontal overflow.
- Observed `document.modelContext` and `notify_once` registration in the Codex in-app browser. Broader native WebMCP conformance remains `INCONCLUSIVE`.
- Excluded the ignored host-only Impeccable hook cache from reproducible integrity catalogs so clean GitHub checkouts produce the same file identities.
- Replaced the unused Inter declaration with an offline Mac-safe Avenir Next and Japanese Gothic stack, with a regression check for overused web fonts.
- Added one strict three-field input projector shared by the WebMCP callback and localhost preview API; unknown fields, inherited values, accessors, invalid types, control characters, malformed Unicode, and length violations fail closed.
- Added a visible `received -> strict validation -> dry run only` boundary, with a rejection state that leaves the form, SQLite intent store, audit chain, and external-effect count unchanged.
- Restricted WebMCP exposure to the same origin, kept notification permission outside the callback, and stopped reflecting notification title or body in tool results.
- Isolated `document.modelContext` and `registerTool()` behind one notification adapter, with typed unavailable, permission-denied, security-rejected, and registration-failed results.
- Added a server-derived input-provenance contract and persisted WebMCP channel, trust, origin, annotation, and derivation in the first SQLite-backed audit event.
- Added independent provenance readback, cross-channel duplicate preservation, exact-origin rejection, and a visible provenance rail without triggering a real notification.
- Excluded ignored Playwright browser-output files from the reproducible public catalog after the first GitHub clean-checkout run exposed the host-only mismatch.

<!-- information_uuid_v5=98e355d2-8469-5427-937c-a922fcf5ad50 event_uuid_v7=01a04896-44e4-74b6-803b-38cd809c1837 state_transition=REVIEW -> VERIFIED occurred_at=2026-08-28T13:36:42.724Z -->

## 0.2.0 — 2026-08-28

- Added a SQLite-backed notification intent, attempt, and effect ledger with a unique logical-operation constraint.
- Added UUIDv5 intent identity, UUIDv7 transition identity, approval binding, ambiguous-effect reconciliation, and a hash-chained JSON Lines audit log.
- Added simulated failure, response-loss, restart, duplicate-retry, approval-expiry, schema, type, and 100-sample latency checks.
- Added a localhost browser notification demo. One real notification was displayed after immediate user approval; the same-operation retry was suppressed and the external-effect claim count remained one.
- Published the six-event live audit chain and machine-readable verification summary, including Service Worker readback and the `ALREADY_VERIFIED` retry result.
- Native WebMCP support remains `INCONCLUSIVE` because `document.modelContext` was absent in the tested browser.
- Split artifact regeneration from read-only validation and pinned Python and Node.js dependencies.

## 0.1.0 — 2026-08-27

- Initial bilingual architecture specification.
- Added source/claim/formula/requirement knowledge graph.
- Added UUIDv5/v7 and RFC 3339 temporal metadata.
- Added JSON Schema, Canonical IR, TypeScript evaluator, Wolfram model, TLA+ model, and independent reachability checker.
- Added signed sample audit chain, Merkle checkpoint, inclusion proof, and tamper report.
- Added stochastic SLO model and synthetic time series.
