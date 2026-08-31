// information_uuid_v5=962e87cc-858f-54d7-a9bb-56bd97d79434
// event_uuid_v7=01a04b72-7d08-769c-bdfb-e8245d6244c9
// machine-contract: the visible proof reads the current device-local audit chain and never invents a successful check.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { deriveHotelBookingResult } from "../../../examples/hotel-booking-demo/visual-state.js";

const paths = Object.freeze({
  html: new URL("../../../index.html", import.meta.url),
  application: new URL("../../../examples/hotel-booking-demo/app.js", import.meta.url),
  styles: new URL("../../../examples/hotel-booking-demo/styles.css", import.meta.url),
});

test("the booking explanation contains an accessible, current audit proof", async () => {
  const [html, application] = await Promise.all([readFile(paths.html, "utf8"), readFile(paths.application, "utf8")]);

  const details = html.match(/<details>[\s\S]*?<\/details>/u)?.[0] ?? "";
  assert.match(html, /<p id="state-summary" class="state-summary" aria-live="polite">/u);
  const resultBox = html.match(/<div class="result-box"[^>]*>/u)?.[0] ?? "";
  assert.equal((html.match(/id="state-summary"/gu) ?? []).length, 1);
  assert.match(resultBox, /aria-atomic="true"/u);
  assert.doesNotMatch(resultBox, /aria-live=/u);
  for (const id of ["proof-fingerprint", "proof-event-count", "proof-latest-event", "proof-chain-head", "proof-chain-valid"]) {
    assert.match(details, new RegExp(`id="${id}"`, "u"));
  }
  assert.match(details, /aria-live="polite"/u);
  assert.match(details, /aria-busy="true"/u);
  assert.match(application, /listHotelBookingEvents/u);
  assert.match(application, /audit\.events\.at\(-1\)/u);
  assert.match(application, /proofEventCount\.textContent = String\(audit\.events\.length\)/u);
  assert.match(application, /eventHead\.slice\(0, 12\)/u);
  assert.match(application, /const chainIsValid = audit\.chainValid && audit\.fingerprint === fingerprint;/u);
  assert.doesNotMatch(application, /matchesStatus/u);
  assert.match(application, /function markAuditProofRechecking\(\) \{[\s\S]*auditRenderGeneration \+= 1;/u);
  assert.match(application, /function invalidateVisibleApproval\(\) \{[\s\S]*markAuditProofRechecking\(\);/u);
  assert.match(application, /proofFingerprint\.textContent = "Rechecking…";/u);
  assert.match(application, /chainIsValid \? "Valid" : "Check failed"/u);
  assert.match(application, /deriveHotelBookingResult\(status\)/u);
  assert.match(application, /stateSummary: document\.querySelector\("#state-summary"\)/u);
  assert.match(application, /elements\.stateSummary\.textContent = result\.summary;/u);
  assert.match(application, /elements\.resultSummary\.textContent = result\.summary;/u);
  assert.doesNotMatch(application, /2 attempts → 1 simulated booking → 1 confirmation number/u);
  assert.doesNotMatch(details, /(?:\/Users\/|\/private\/|token|secret|api[_-]?key)/iu);
});

test("the audit proof preserves readable wrapping and a one-column mobile layout", async () => {
  const styles = await readFile(paths.styles, "utf8");
  assert.match(styles, /\[hidden\] \{ display: none !important; \}/u);
  assert.match(styles, /\.audit-proof-grid code \{[^}]*overflow-wrap: anywhere;/su);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.audit-proof-grid \{ grid-template-columns: 1fr; \}/u);
  assert.match(styles, /\.chain-state\[data-state="valid"\] \{ color: var\(--success\); \}/u);
  assert.match(styles, /\.chain-state\[data-state="invalid"\] \{ color: var\(--warning\); \}/u);
});

test("the page explains the practical difference between an ordinary retry and WebMCP", async () => {
  const [html, styles] = await Promise.all([readFile(paths.html, "utf8"), readFile(paths.styles, "utf8")]);
  const comparison = html.match(/<section class="why-webmcp"[\s\S]*?<\/section>/u)?.[0] ?? "";

  assert.match(comparison, /WebMCP is a small, named contract/u);
  assert.match(comparison, /Ordinary form retry/u);
  assert.match(comparison, /Possible result: 2 bookings/u);
  assert.match(comparison, /WebMCP safe retry/u);
  assert.match(comparison, /Verified result: 2 attempts → 1 booking/u);
  assert.match(comparison, /Does this exact booking already exist\?/u);
  assert.match(comparison, /class="retry-comparison"/u);
  assert.match(styles, /\.retry-path-risk \{ border-color: var\(--warning\); \}/u);
  assert.match(styles, /\.retry-path-safe \{ border-color: var\(--success\); \}/u);
  assert.match(styles, /@media \(max-width: 600px\)[\s\S]*\.retry-comparison[\s\S]*grid-template-columns: 1fr;/u);
});

test("empty, prepared, and committed states never expose a confirmation number", async () => {
  const results = [
    deriveHotelBookingResult({ state: "EMPTY", attemptCount: 0, bookingExists: false, effectStartCount: 0 }),
    deriveHotelBookingResult({ state: "PREPARED", attemptCount: 1, bookingExists: false, effectStartCount: 0 }),
    deriveHotelBookingResult({
      state: "COMMITTED",
      attemptCount: 1,
      bookingExists: true,
      effectStartCount: 1,
      confirmationNumber: "FKR-SHOULD-STAY-HIDDEN",
    }),
  ];

  assert.deepEqual(
    results.map(({ summary, confirmationNumber }) => ({ summary, confirmationNumber })),
    [
      { summary: "No booking result yet.", confirmationNumber: null },
      { summary: "No booking result yet; human confirmation is still pending.", confirmationNumber: null },
      {
        summary: "The success response was intentionally hidden. 1 attempt → 1 simulated booking → 1 effect start.",
        confirmationNumber: null,
      },
    ],
  );
});

test("retry proof derives attempts, bookings, and effect starts from the current state", async () => {
  const twoAttempts = deriveHotelBookingResult({
    state: "RETRY_RECOGNIZED",
    attemptCount: 2,
    bookingExists: true,
    effectStartCount: 1,
    confirmationNumber: "FKR-TEST-0001",
  });
  const threeAttempts = deriveHotelBookingResult({
    state: "RETRY_RECOGNIZED",
    attemptCount: 3,
    bookingExists: true,
    effectStartCount: 1,
    confirmationNumber: "FKR-TEST-0001",
  });

  assert.equal(twoAttempts.summary, "Retry recognized: 2 attempts → 1 simulated booking → 1 effect start. The existing confirmation was recovered.");
  assert.equal(twoAttempts.confirmationNumber, "FKR-TEST-0001");
  assert.equal(threeAttempts.summary, "Retry recognized: 3 attempts → 1 simulated booking → 1 effect start. The existing confirmation was recovered.");
  assert.equal(threeAttempts.confirmationNumber, twoAttempts.confirmationNumber);
});
