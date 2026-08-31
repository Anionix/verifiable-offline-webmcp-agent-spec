---
title: "Kyoto Booking Retry Proof — reproducible release package"
language: "en"
information_uuid_v5: "4f18aaff-864b-5bbd-a2ce-1c33f0add5f2"
event_uuid_v7: "01a050c7-34b7-7168-8c64-9443fbe87f36"
state_transition: "UNPACKAGED_HOTEL_ARTIFACT -> REPRODUCIBLE_RELEASE_PACKAGE"
occurred_at: "2026-08-30T04:20:00Z"
public_release_alignment_event_uuid_v7: "01a0576f-4c85-7731-b4b3-3833d8af4a2f"
updated_at: "2026-08-31T10:48:27.013Z"
status: "release-guide"
---

# Reproducible hotel release package

This package makes the fictional Kyoto hotel demo easy to run, inspect, and show to a judge. The short route is in [`examples/hotel-booking-demo/README.md`](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/examples/hotel-booking-demo/README.md). The screenshot and video route is in the [English visual guide](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.en.md), with a [short Japanese guide](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.ja.md).

## What the command creates

`npm run release:hotel` builds and validates the existing demo, then writes `release/kyoto-booking-retry-proof/`:

- `dist/client/**` — the static client for Vercel, Netlify, and Render checks.
- `dist/server/index.js` — the ChatGPT Sites server entry point.
- `dist/.openai/hosting.json` — the Sites hosting wrapper.
- `README.md` — the concise English-first judge route with a Japanese summary.
- `DEVPOST_VISUAL_GUIDE.md` and `DEVPOST_VISUAL_GUIDE_JA.md` — the six-panel visual route.
- `RELEASE_GUIDE.md` — this command and verification guide.
- `LICENSE` — Apache License 2.0.
- `release-manifest.json` — source commit, public links, state transition, digests, and file receipts.
- `SHA256SUMS` — the sorted SHA-256 list for the package.

Video binaries, credentials, environment files, personal information, and real booking data are excluded.

The release-package validator is unavailable on Windows because safe non-following file opens cannot be guaranteed; this is separate from the browser demo itself.

<!-- machine-contract information_uuid_v5=4f18aaff-864b-5bbd-a2ce-1c33f0add5f2 event_uuid_v7=01a054f1-6b9b-7d84-8a31-53a43a4a52a0 state_transition=PER_OPERATION_HELPER_STARTUP -> ONE_BOUND_ROOT_HELPER_PER_VALIDATION occurred_at=2026-08-30T23:11:43.003Z -->
One isolated Python process serves the whole validation, including all three tree enumerations. Requests run sequentially, recheck their directory chain each time, and use increasing sequence numbers and exact response byte counts. Each request and final shutdown has a five-second limit within the existing thirty-second validation deadline. Any malformed response or process failure ends validation; the helper closes before the retained root descriptor.

On POSIX, validation holds the root as a Node `O_NOFOLLOW|O_DIRECTORY` descriptor and passes only fd 3 to an isolated Python helper. Nested list, stat, and file-read requests use strict relative components and `dir_fd`-relative `O_NOFOLLOW` opens; regular-file bytes are bounded to 8 MiB. Ancestors above the resolved release-root entry remain trusted because Node v24.15 has no `openat`-style API. See the [Node.js v24.15 file-system API](https://nodejs.org/download/release/v24.15.0/docs/api/fs.html), [Node.js child-process stdio](https://nodejs.org/download/release/v24.15.0/docs/api/child_process.html#optionsstdio), and [Python `os.listdir`](https://docs.python.org/3.14/library/os.html#os.listdir) references. This protects the bounded descriptor operations but does not claim an atomic snapshot.

## Reproduce the package

Run from one clean, committed source checkout. The builder stops if the working tree is dirty, if the source commit changes, if a required public-evidence digest differs, or if Gitleaks is unavailable.

After a release branch is deleted, keep the source and base commits reachable from a durable annotated evidence tag so a fresh clone can validate the package by full commit hashes.

```bash
npm ci
npm run build:web
npm run validate:hotel
npm run release:hotel
npm run validate:hotel:release
```

Check every recorded package file:

```bash
cd release/kyoto-booking-retry-proof
shasum -a 256 -c SHA256SUMS
```

To prove repeatability on the same commit:

```bash
npm run release:hotel
cp release/kyoto-booking-retry-proof/SHA256SUMS /tmp/kyoto-booking-retry-proof.first.sha256
npm run release:hotel
cmp /tmp/kyoto-booking-retry-proof.first.sha256 release/kyoto-booking-retry-proof/SHA256SUMS
```

`release/` is ignored by Git. Keep the manifest and checksum output with the release record when distributing the package; do not add the video itself to the source repository.

## Judge-facing boundaries

The demo uses only the fictional `Fictional Kyoto Ryokan` and `Standard Flexible` plan. WebMCP exposes `check_existing_hotel_booking`, `prepare_hotel_booking`, `get_hotel_booking_status`, and `preview_hotel_cancellation`. It does not expose confirmation, payment, or cancellation mutation to an agent. A human-only visible button commits the simulated booking.

The result is browser-local and publication-target-specific. `2 attempts → 1 simulated booking → 1 confirmation number` is a deterministic demonstration, not an external hotel transaction. The recorded Vercel production deployment `dpl_HWJVg4uCgFEaq9N2f5kvXwLjvK2E` serves source commit `2d5abd679893ec7dff36758925477999424c3cc7`. The submitted ChatGPT Site is version 14 from source commit `2fbbf1b714ca660ef1681239b638205a9835f7c5`; both public evaluation files report 194 tests and the exact four-tool contract. A fresh managed browser proof ran through the canonical public HTTPS alias after READY and is stored in the native reconciliation record. The deployment-specific alias was independently read but redirected to sign-in in that isolated browser. This proves the recorded configuration, not broad conformance of every Chrome release. Physical keyboard and screen-reader evidence, and local-video-to-YouTube file identity, remain explicitly limited in the manifest and verification records. See the [public release readback](../metadata/hotel-public-release-readback.json), [public alignment readback](../metadata/public-release-alignment-readback.json), and [native reconciliation record](../metadata/hotel-native-webmcp-reconciliation.json).

## Related evidence

- [Primary ChatGPT Site](https://kyoto-booking-retry-proof.anionix.chatgpt.site)
- [Vercel backup](https://kyoto-booking-retry-proof.vercel.app)
- [Devpost project](https://devpost.com/software/project-y79pb23hj1mz)
- [Public video](https://youtu.be/tdSvJw4ghX8)
- [Source repository](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec)
- [Japanese release guide](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/24-hotel-release-package.ja.md)
