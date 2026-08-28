# Changelog

<!-- information_uuid_v5=06f137fc-6ca9-5499-b447-b9cd9df976b5 event_uuid_v7=01a048c2-e3c4-7c0c-9abb-21b175b0719a state_transition=IMPLEMENTING -> BROWSER_VERIFIED occurred_at=2026-08-28T14:25:32.776Z -->

## 0.3.0-candidate — 2026-08-28

- Added a state-driven visualization in which the initial request and same-operation retry converge on one SQLite-backed intent ledger.
- Added a measured external-effect count; values above one are disclosed as safety violations instead of being rounded to a successful result.
- Added automated checks for the one-effect invariant, ambiguous reconciliation, violation disclosure, status semantics, responsive layout, and reduced motion.
- Verified the dry-run screen at `1440 x 1000` and `390 x 844` without requesting another real notification; the narrow view had no horizontal overflow.
- Observed `document.modelContext` and `notify_once` registration in the Codex in-app browser. Broader native WebMCP conformance remains `INCONCLUSIVE`.
- Excluded the ignored host-only Impeccable hook cache from reproducible integrity catalogs so clean GitHub checkouts produce the same file identities.
- Replaced the unused Inter declaration with an offline Mac-safe Avenir Next and Japanese Gothic stack, with a regression check for overused web fonts.

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
