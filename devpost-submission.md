---
title: "Kyoto Booking Retry Proof — Devpost submission packet"
information_uuid_v5: "faef02a2-712f-5fd3-b88f-dc44bc45db1f"
event_uuid_v7: "01a04d7a-8fe8-74bd-ab4c-fbc8bfa1eb42"
occurred_at: "2026-08-29T12:24:33.000Z"
state_transition: "GENERIC_PROJECT_COPY -> HOTEL_DEMO_ALIGNED -> VERSION_11_60_SECOND_TEST_PUBLIC -> OPEN_GRAPH_STALE_PROJECT_IMAGE_ASSOCIATION_INCONCLUSIVE -> FINAL_SUBMISSION_PENDING"
---

# Title

Kyoto Booking Retry Proof

<!-- machine-contract: This document is the hotel-demo submission packet for Devpost project 1405191. It is not proof of final WebMCP Challenge submission. Only a later Devpost readback with non-null submitted_at may establish that fact. -->

## One-line Summary

WebMCP stops a lost hotel-booking response from becoming a duplicate reservation.

## Problem

An international traveler books a hotel while arriving in Japan. The booking reaches the device, but unreliable airport connectivity hides the success response. The page looks as if it failed. Sending the same form again can create a second reservation, and cancelling it through an unfamiliar Japanese site is slow, stressful, and easy to get wrong.

The ordinary question is simple: **Did this exact booking already go through?** A visual interface alone may not give an assistant a safe, structured way to answer it before retrying.

## Solution

The demo uses the fictional `Fictional Kyoto Ryokan` and one `Standard Flexible` plan. The site exposes exactly four narrow WebMCP capabilities:

1. `check_existing_hotel_booking` checks whether the same device-local booking already exists.
2. `prepare_hotel_booking` validates the input, price, and cancellation terms, then creates a 120-second preparation.
3. `get_hotel_booking_status` recovers the same status and confirmation number after a response disappears.
4. `preview_hotel_cancellation` reports the free-cancellation deadline and estimated fee without changing state.

WebMCP cannot confirm, pay for, or cancel a booking. Only the visible **Confirm booking — human action only** button can commit the simulated reservation. The demo deliberately hides the successful response and then retries the same booking. The visible result is:

`2 attempts → 1 simulated booking → 1 confirmation number`

## Why This Matters

Without WebMCP, an assistant may have to infer state from pixels, labels, and a stale page, or resend the whole form and hope. WebMCP lets the website publish small named capabilities with checked inputs and structured results. The assistant can ask the site for the existing state before repeating an action.

For a traveler, that means less risk of paying twice, less time translating cancellation instructions, and less need to contact support. For a website, it keeps the final decision with the person while giving an assistant a safe way to recover from uncertainty. The same pattern can help reservations, purchases, tickets, and forms whenever a request may have succeeded but its response was lost.

## How We Used AI

Artificial-intelligence tools helped produce and explain the evidence; they do not make or approve the simulated booking.

- Higgsfield generated two clearly labelled fictional opening scenes about a lost response and duplicate notifications.
- OpenArt generated the fictional adult traveler reference image.
- HeyGen produced English narration with a stock public voice; no voice clone or avatar was used.
- Canva produced visual assets, and vidIQ helped compare video-title candidates.
- The public video contains 20 seconds of labelled generated dramatization and 113.2 seconds of actual public Site screen recording.

No model application programming interface key, server-side model call, personal information, real hotel, payment, or external reservation is used by the running demo.

## How We Used Codex

Codex helped turn the retry-safety idea into a working, reviewable implementation: it edited the plain JavaScript and TypeScript code, added deterministic tests, checked browser behavior, built the ChatGPT Sites and static packages, and kept machine-readable deployment and verification evidence. In the ChatGPT in-app browser, Codex discovered and executed the four WebMCP tools and verified that preparation enables a separate human confirmation action. It also helped keep uncertain findings explicitly marked `INCONCLUSIVE` or `UNMEASURED` instead of presenting them as successes.

## Key Features

- Stable UUID version 5 identity from hotel, plan, dates, adults, and rooms; display language is excluded.
- IndexedDB uniqueness rules for both booking identity and confirmation number.
- One transaction for human approval, the committed simulated booking, and the effect-start count.
- UUID version 7 event identifiers and a SHA-256 forward chain for visible, time-ordered history.
- Recovery across repeated clicks, two tabs, reload, and retry.
- Offline restoration after the first successful page load.
- English-first interface with Japanese support.
- Visible proof panel for the stable identity, event count, latest event, chain head, and chain validity.
- Exactly four safe WebMCP tools; no confirmation, payment, or cancellation mutation tool.

## Architecture

```text
Traveler input
    ↓
Four narrow WebMCP tools: check / prepare / status / cancellation preview
    ↓
Visible human-only confirmation
    ↓
IndexedDB unique booking + UUIDv7 event + SHA-256 history link
    ↓
Lost response
    ↓
Retry reads the same UUIDv5 booking and returns the same confirmation
```

The client is plain JavaScript built with Vite. TypeScript tests verify the model and storage behavior. ChatGPT Sites receives `dist/server/index.js`, `dist/client/**`, and `dist/.openai/hosting.json`; Vercel serves the same static client. There is no server database or file store. ChatGPT Sites and Vercel have separate browser storage, so the page says that each result belongs only to that device and deployment.

## Testing Instructions

### Fast public test

1. Open the [primary ChatGPT Site](https://kyoto-booking-retry-proof.anionix.chatgpt.site) in a fresh browser storage context.
2. Keep the default fictional booking, or select valid dates, one to four adults, and one or two rooms.
3. Select **1. Check and prepare**.
4. Confirm that the state is `PREPARED` and the separate human-only button becomes available.
5. Select **2. Confirm booking — human action only**. The page stores one simulated booking but intentionally hides its successful response.
6. Select **Retry the same booking**.
7. Verify `RETRY_RECOGNIZED`, attempts `2`, bookings `1`, effect starts `1`, and the same confirmation number.
8. Expand **Why this stays one booking** and verify that the SHA-256 chain check is `Valid`.
9. Reload the page and verify that the same result is restored.

### Repository checks

```bash
npm ci
npm run quality:check
npm run build:web
npm run validate:hotel
cd src/typescript
npm test
npm run typecheck
```

Current repository evidence records **153 passing Node tests**, TypeScript checking, source-quality checks, repository schemas, production builds, and two consecutive full validation runs. Fresh public browser runs reached two attempts, one booking, and one effect start. The booking test also counts one physical row in the IndexedDB booking store.

## Public Demo Link

- Primary: https://kyoto-booking-retry-proof.anionix.chatgpt.site
- Backup: https://kyoto-booking-retry-proof.vercel.app

Both are fictional, require no account or personal information, and perform no payment or external reservation.

## Public Repository Link

https://github.com/Anionix/verifiable-offline-webmcp-agent-spec

License: Apache-2.0.

## Demo Video

https://youtu.be/tdSvJw4ghX8

Title: **WebMCP vs Duplicate Bookings: A Live Demo**

The public video is 150 seconds. Public readback confirms anonymous playback, English audio and captions, and a published Japanese subtitle track. The first 20 seconds are labelled artificial-intelligence-generated dramatization; most of the video is actual public Site screen recording.

## Screenshot Shot List

1. Hero and `EMPTY` state: **Did my hotel booking go through?**
2. `PREPARED` state with the human-only confirmation button enabled.
3. Lost-response state showing that the simulated booking remains on the device.
4. `RETRY_RECOGNIZED` with attempts `2`, bookings `1`, effect starts `1`, and the proof panel.
5. Four WebMCP capability cards and the honest service-state table.

The proposed Devpost thumbnail is the actual public hotel demo in `RETRY_RECOGNIZED`, stored at `docs/assets/devpost-hotel-thumbnail.png`. Its SHA-256 is `c4b1df6eadc389cee52c5edef7fb716ae9abbe9d604d55dc592eb0ae35578e10`. The upload receipt returned `https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/005/194/459/datas/medium.png`, which returned anonymous HTTP 200. Anonymous project-page HTML still exposes Devpost's default `og:image`, so the uploaded asset's association with the public project card is `INCONCLUSIVE`, not claimed as complete.

## Submission Readiness Notes

- Devpost project: https://devpost.com/software/project-y79pb23hj1mz
- Devpost project identifier: `1405191`
- Current project title: `Kyoto Booking Retry Proof`
- Current tagline: `WebMCP stops a lost hotel-booking response from becoming a duplicate reservation.`
- The hotel-copy update operation returned version `8`; the complete technology/link update advanced the project to version `9`; the judge-readable heading and retry-list update returned version `10`; the public 60-second reproduction steps returned version `11`.
- Authenticated readback and anonymous HTML confirm the page title, heading, tagline, 153-test description, public links, video, and four reproduction steps. Anonymous HTML still reports `og:title` as the old `未定` value.
- The hotel-demo image upload succeeded and its content-delivery URL returned anonymous HTTP 200. Anonymous HTML still uses Devpost's default `og:image`, so public project-image association remains `INCONCLUSIVE` until a later Devpost-owned readback proves it.
- The WebMCP Challenge `submitted_at` field was `null` in the latest readback. Final challenge submission is therefore still pending.
- Official deadline readback: `2026-09-03T20:00:00Z` (`2026-09-04 05:00` in Japan).

### Judging alignment

| Official judging area | Concrete evidence |
|---|---|
| WebMCP leverage | Four small named tools let the assistant check and recover state before retrying, while confirmation stays human-only. |
| Execution | Public ChatGPT Site and Vercel backup, 153 Node tests, fresh-storage browser proof, offline reload, and a public 150-second video. |
| Potential impact | Prevents an ordinary lost response from becoming a second reservation and avoids foreign-language cancellation work for travelers. |
| Creativity and ambition | Combines safe retry, local-first recovery, stable identity, uniqueness constraints, and a visible cryptographic history without granting the assistant payment or cancellation authority. |

## Known Limitations

- The hotel, booking, confirmation number, price, and cancellation preview are fictional and device-local.
- ChatGPT Sites and Vercel do not share IndexedDB storage.
- Native WebMCP discovery and execution in the connected Google Chrome session remain `INCONCLUSIVE`; the ChatGPT in-app browser execution is the bounded confirmed result.
- Physical keyboard traversal and screen-reader operation remain `INCONCLUSIVE` because no independent hardware-keyboard or VoiceOver session was recorded.
- The local final-video SHA-256 and the public YouTube identifier are not bound by an independent upload receipt, so artifact identity remains `UNMEASURED`.
- Devpost's visible page title and heading show `Kyoto Booking Retry Proof`, but its anonymous Open Graph title remains `未定`; the uploaded hotel image is public while its project-card association remains `INCONCLUSIVE`.
- The running demo does not make, pay for, email, cancel, or contact any real service.
- Final Devpost challenge submission remains pending until the submit operation succeeds and Devpost readback shows a non-null submission time.

## TODO Official Form Fields

The owner confirmed the four required personal answers. Because the submitter type is Individual, the optional organization field is not applicable and will be omitted.

| Field identifier | Official field | Required | Prepared answer | State |
|---|---|---:|---|---|
| `28249` | Submitter Type | Yes | Individual | OWNER CONFIRMED |
| `28250` | Country of residence | Yes | Japan | OWNER CONFIRMED |
| `28251` | Organization | No | Omitted | NOT APPLICABLE FOR INDIVIDUAL |
| `28252` | App Status | Yes | Existing | READY |
| `28253` | Existing-project update | No | Added the fictional Kyoto hotel retry experience, four hotel-specific WebMCP capabilities, human-only confirmation, browser-local recovery, responsive and offline behavior, public Sites and Vercel deployments, verification evidence, and the 150-second narrated video during the submission period. | READY |
| `28254` | Live URL | Yes | https://kyoto-booking-retry-proof.anionix.chatgpt.site | READY |
| `28255` | Testing instructions | No | Follow **Fast public test** above and verify `RETRY_RECOGNIZED`, attempts 2, bookings 1, effect starts 1, and chain `Valid`. | READY |
| `28256` | Public repository | Yes | https://github.com/Anionix/verifiable-offline-webmcp-agent-spec | READY |
| `28257` | Tested agents or clients | Yes | OpenAI Codex in-app browser for WebMCP discovery and execution; Google Chrome for ordinary page interaction. Native Chrome WebMCP execution remains `INCONCLUSIVE`. | READY |
| `28258` | Artificial-intelligence tools | Yes | OpenAI Codex and ChatGPT, Higgsfield, OpenArt, HeyGen, Canva, and vidIQ. | READY |
| `28259` | Learning level | Yes | Significant | OWNER CONFIRMED |
| `28260` | Career artificial-intelligence value | Yes | Yes | OWNER CONFIRMED |

Project video URL: https://youtu.be/tdSvJw4ghX8 (`READY_AND_LINKED`).
