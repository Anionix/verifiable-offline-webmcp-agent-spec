# TypeScript reference

The reference evaluator uses exact BigInt cross-products at decision boundaries and shares golden vectors with the Python and Wolfram references. The notification candidate uses the Node.js 24 built-in SQLite module and is therefore pinned separately in `.node-version` and `package-lock.json`.

<!-- information_uuid_v5=3af6adc7-b561-5e0e-941d-625d6b87a3db event_uuid_v7=01a04967-af58-783f-9679-8a371e632c17 state_transition=PROPOSED -> EXECUTING occurred_at=2026-08-28T17:25:27.000Z -->

```bash
npm ci
npm test
npm run typecheck
```

## Pre-execution governance boundary

`governance/security-boundary.ts` performs tool discovery and contract lookup before planner exposure. It exposes proposal-only capabilities that are also available to the executor, rejects critical commit tools, verifies critical mandates with Ed25519, binds approvals to normalized inputs and expiry, blocks secret-shaped planner context, and treats tool or page text as untrusted data. The matching test names use the verification-catalog identifiers, so each previously specified security requirement can be searched directly.

## Duplicate-safe notification candidate

`notification/` separates control state from external-effect state, persists intent/attempt/effect rows in SQLite, and appends a SHA-256 hash-chained JSON Lines record for every transition. UUIDv5 identifies the logical notification intent and UUIDv7 identifies each attempt and transition.

Audit and SQLite paths retain the parent directory identity captured at construction and recheck it before later file reads, appends, or SQLite startup. Replacing that parent with a link or another directory is rejected before bytes or SQLite sidecars can be written. Disk-backed `NotificationStore` is intentionally POSIX-only: Windows fails closed because `node:sqlite` `DatabaseSync` cannot bind its internal file handle to the reviewed storage descriptor. `:memory:` remains supported on Windows.

```bash
npm run benchmark:notification
npm run demo:notification
```

The simulated adapter never calls an external service. The browser demo is localhost-only and requests a real notification only after an explicit click. `AMBIGUOUS` blocks `execute` and permits `reconcile` only.

## Signed offline synchronization candidate

`sync/` creates per-device Ed25519 chains and signed Merkle checkpoints, then ingests them into a persistent SQLite ledger without changing device-local order. The synchronizer automatically materializes only an add-only tag set. Notification, payment, reservation, and deletion intents become `HUMAN_REVIEW_REQUIRED`; this module has no external-effect executor.

```bash
npm run evidence:sync
npm run demo:sync
```

Evidence generation is an explicit write step. `npm test`, `npm run typecheck`, and repository `make validate` are read-only.

## Optional online planner candidate

`planner/` separates local availability, preflight disclosure, one bounded transport attempt, and an untrusted candidate. The production transport is only an interface; the checked-in evidence uses a scripted local transport and makes no network request. Tool exposure is allowlisted and proposal-only, private fields are removed, unknown pricing stops before transport, and timeout or response loss never retries automatically.

```bash
npm run evidence:planner
npm run demo:planner
```

The demo server is read-only. It serves public evidence, a sanitized request sample, and a hash-chained audit record; it has no model, approval, notification, or mutation route.
