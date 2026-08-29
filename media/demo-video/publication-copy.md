---
title: "Publication copy for the fictional Kyoto booking retry demo"
information_uuid_v5: "22ea7511-834f-5b4f-b08b-9d6e95328540"
event_uuid_v7: "01a04d7b-5431-78e2-a367-235829d5edc4"
occurred_at: "2026-08-29T12:25:26.450Z"
state: "DEVPOST_VERSION_11_SIXTY_SECOND_TEST_PUBLIC_IMAGE_ASSOCIATION_INCONCLUSIVE_FINAL_SUBMISSION_PENDING"
state_transition: "NOT_AUTHORED -> JUDGING_CRITERIA_BOUND -> TITLE_CHECKED -> REVIEW_READY -> DEVPOST_PROJECT_PAGE_PUBLISHED -> THUMBNAIL_SAVED_AND_SOURCE_MERGED -> YOUTUBE_PUBLIC_VERIFIED -> DEVPOST_VIDEO_LINKED_FINAL_SUBMISSION_PENDING -> ARTIFACT_TO_VIDEO_IDENTITY_UNMEASURED -> DEVPOST_HOTEL_PROJECT_ALIGNED -> DEVPOST_HOTEL_IMAGE_UPLOAD_ACCEPTED -> DEVPOST_VERSION_11_SIXTY_SECOND_TEST_PUBLIC -> DEVPOST_OPEN_GRAPH_STALE_IMAGE_ASSOCIATION_INCONCLUSIVE -> FINAL_SUBMISSION_PENDING"
---

# Publication copy

<!-- machine-contract: This file records the public YouTube video, the hotel-aligned Devpost project, and the owner-confirmed submission answers. It is not evidence of final challenge submission; only a Devpost readback with non-null submitted_at may prove that transition. -->
<!-- information_uuid_v5=8e656bba-df14-5ee2-9348-f6239fb7edf9 event_uuid_v7=01a04cf7-edba-71cd-b1c5-c8271758d1b4 state_transition=SELF_CERTIFIED_ARTIFACT_BINDING -> ARTIFACT_TO_VIDEO_IDENTITY_UNMEASURED occurred_at=2026-08-29T10:01:51.802Z -->
<!-- machine-contract: Public playback, title, duration, and subtitles remain readback facts. The local file digest and public YouTube identifier are not asserted to identify the same artifact without an independent upload-operation receipt. -->

## YouTube

### Title

WebMCP vs Duplicate Bookings: A Live Demo

Public video: https://youtu.be/tdSvJw4ghX8

The title was one of five candidates generated in a single vidIQ call. Its returned score was 86. The higher-scoring “Never Double Book Again” candidate was rejected because it overstates the demonstrated scope.

### Description

What happens when a hotel booking reaches the device, but the success response disappears?

This 2 minute 30 second WebMCP Challenge demo follows an international traveler using a fictional Kyoto hotel site on an unreliable connection. The traveler retries the same request, but the second attempt finds the first result instead of creating another booking.

Verified result:

- 2 attempts
- 1 simulated booking
- 1 effect start
- 1 confirmation number

WebMCP gives the assistant four small, named capabilities:

- check whether the same booking already exists
- validate and prepare a booking
- recover the booking status after a lost response
- preview cancellation terms without changing the booking

Confirmation, payment, and cancellation are intentionally not exposed to the assistant. Only the visible human confirmation button can commit the fictional booking.

The demo uses a stable booking identity, IndexedDB uniqueness rules, time-ordered event identifiers, and a SHA-256 history chain. It runs on ChatGPT Sites and Vercel, restores the fictional result after reload, and remains useful after the first page load when the connection disappears.

Live demo: https://kyoto-booking-retry-proof.anionix.chatgpt.site

Backup: https://kyoto-booking-retry-proof.vercel.app

Source: https://github.com/Anionix/verifiable-offline-webmcp-agent-spec

The first 20 seconds are labeled artificial-intelligence-generated dramatization. The hotel, traveler, reservation, and confirmation are fictional. No personal information, payment, real hotel, or external reservation is used.

### Chapters

00:00 The response disappears

00:10 Why a second booking hurts

00:20 The working WebMCP demo

01:12 One human confirmation

01:23 Safe retry and recovery

01:51 Verifiable local history

02:13 Honest service states

02:22 Two attempts become one booking

### Search terms

WebMCP, safe retry, duplicate booking, artificial-intelligence agent, hotel booking, offline web application, ChatGPT Sites, Vercel, WebMCP Challenge

### Thumbnail

The owner selected Canva candidate 4. It is saved as editable Canva design `DAHTp751k_A`: https://www.canva.com/d/2fXzKdOp48h88cO

The upload-ready local derivative is `.local/video-production/youtube-thumbnail-v1.png`: 1280×720, 148,053 bytes, SHA-256 `14f2bec542f3a56fc0dece3300a53fb7029559d6b5b4717c7555a3e34890afef`. It contains no person, real hotel, personal information, or external-booking claim.

The in-app browser could not open YouTube's custom-thumbnail file chooser after three bounded attempts, so the public video currently uses an automatically generated YouTube thumbnail. The Canva design and upload-ready derivative remain preserved; no phone or identity verification was started.

## Devpost

### Project name

Kyoto Booking Retry Proof

### Tagline

WebMCP stops a lost hotel-booking response from becoming a duplicate reservation.

### Description

## The ordinary problem

A traveler books a hotel while arriving in Japan. The request reaches the device, but unreliable airport Wi-Fi hides the success response. The page looks as if it failed. Retrying the whole form can create a second reservation, and cancelling it through an unfamiliar Japanese site is slow and stressful.

## What this project does

This project turns that uncertainty into a question the page can answer:

> Did this exact booking already go through?

The fictional Kyoto hotel demo exposes four narrow WebMCP capabilities. An assistant can check for the same booking, validate and prepare it, recover its status after a lost response, and preview cancellation terms without changing anything. The assistant cannot confirm, pay for, or cancel a booking. A visible human button is the only way to commit the simulated reservation.

The demonstrated retry ends with:

- two attempts
- one simulated booking
- one effect start
- one confirmation number

## Why WebMCP is the right fit

Without WebMCP, an assistant must infer meaning from pixels, button labels, and a possibly stale page, or resend the form and hope. WebMCP lets the website publish small named capabilities with checked inputs and structured results. The assistant can ask the site for the existing state before repeating an action.

This is useful beyond hotels. The same pattern applies to payments, restaurant reservations, ticket purchases, form submissions, and any action where the request may have succeeded even though the response was lost.

## Better for people and agents

The person gets a clear answer instead of guessing, translating a cancellation flow, or contacting support. The assistant gets a safe question it can ask without gaining authority to spend money or change a reservation. The website keeps the final confirmation decision with the person.

## How it works

Hotel, plan, dates, adults, and rooms are normalized into one stable UUIDv5 booking identity. Display language does not affect that identity. IndexedDB places unique constraints on the booking details and confirmation number, so repeated clicks, two tabs, reload, and retry converge on one stored result.

Every state change receives a time-ordered UUIDv7 event and includes the SHA-256 digest of the previous event. The visible proof panel shows the booking identity, event history, effect-start count, and whether the chain is valid. A service worker restores the local fictional result after the first load even when the network disappears.

The implementation uses plain JavaScript, TypeScript tests, Vite, IndexedDB, and a Cloudflare-compatible ChatGPT Sites package. The same static client is also deployed on Vercel.

## What changed during the submission period

This is an existing open-source specification repository. During the submission period, I added the fictional hotel duplicate-booking experience, four hotel-specific WebMCP capabilities, the human-only confirmation boundary, browser-local retry recovery, responsive and offline behavior, public ChatGPT Sites and Vercel deployments, machine-readable deployment evidence, and the 150-second narrated demo.

## Try it

Complete this 60-second check:

1. Open the primary live Site in a fresh browser storage context and select **1. Check and prepare**.
2. Select **2. Confirm booking — human action only**; the page stores one fictional booking and intentionally hides the success response.
3. Select **Retry the same booking**.
4. Verify `RETRY_RECOGNIZED`, attempts `2`, bookings `1`, effect starts `1`, and the same confirmation number.

Primary live site: https://kyoto-booking-retry-proof.anionix.chatgpt.site

Backup live site: https://kyoto-booking-retry-proof.vercel.app

Public source: https://github.com/Anionix/verifiable-offline-webmcp-agent-spec

No account, personal information, payment, real hotel, email, or external reservation is required.

## Verification

The repository passes 153 Node tests, TypeScript checking, source-quality checks, repository schemas, build checks, and two consecutive full validation runs. The public Sites and Vercel builds were exercised from fresh browser storage. Both reached `RETRY_RECOGNIZED` with two attempts, one booking, and one effect start.

Chrome-native WebMCP execution remains explicitly unmeasured because the required interface was not exposed in the connected Chrome session. This limitation is shown rather than reported as a success.

## Media disclosure

The opening airport scenes are artificial-intelligence-generated dramatizations and are labeled as fictional. The remaining demonstration uses real captures of the public fictional-booking site. The narration uses a stock public voice, not a cloned voice or avatar.

### Built with

WebMCP, JavaScript, TypeScript, Vite, IndexedDB, Service Worker, ChatGPT Sites, Vercel, Oxlint, Oxfmt, Biome

### Submission-field draft

| Field | Prepared answer | State |
|---|---|---|
| Submitter Type | Individual | OWNER_CONFIRMED |
| Country of residence | Japan | OWNER_CONFIRMED |
| App Status | Existing | READY |
| Existing-project update | Use “What changed during the submission period” above. | READY |
| Live URL | https://kyoto-booking-retry-proof.anionix.chatgpt.site | READY |
| Testing instructions | Open the live URL, prepare the default fictional booking, confirm it with the visible human button, then retry the same booking. Verify `RETRY_RECOGNIZED`, attempts 2, bookings 1, effect starts 1, and SHA-256 chain `Valid`. | READY |
| Public repository | https://github.com/Anionix/verifiable-offline-webmcp-agent-spec | READY |
| Tested agents or clients | OpenAI Codex in-app browser for discovery and execution; ordinary Chrome page interaction. Native Chrome WebMCP execution remains inconclusive. | READY |
| Artificial-intelligence tools | OpenAI Codex and ChatGPT, Higgsfield, OpenArt, HeyGen, Canva, and vidIQ. | READY |
| Learning | Significant | OWNER_CONFIRMED |
| Career value | Yes | OWNER_CONFIRMED |
| Public video URL | https://youtu.be/tdSvJw4ghX8 | READY_AND_LINKED |

## Current publication boundary

- Canva candidate 4 was owner-selected and saved as editable design `DAHTp751k_A`; the 1280×720 derivative is preserved, but YouTube's custom-thumbnail chooser did not open in the connected browser. The public video therefore uses an automatically generated thumbnail.
- A Devpost image upload used the actual public fictional-hotel result showing `RETRY_RECOGNIZED`, two attempts, one booking, and one effect start. The returned content-delivery URL, `https://d112y698adiu2z.cloudfront.net/photos/production/software_thumbnail_photos/005/194/459/datas/medium.png`, is anonymously reachable. This proves that the image file is public, not that the public project currently uses it.
- The locally measured final video is 150 seconds and has SHA-256 `3c2635029fe01f5a9f20b4effddd62a8d5c1edc28e1e90db443645dbe78c49e7`. Separately, https://youtu.be/tdSvJw4ghX8 returned HTTP 200, anonymous playback, the expected title, and a 150-second public duration; upload processing and copyright checks completed without an issue. No independent upload-operation receipt is retained in this repository, so the local artifact-to-public-video identity is `UNMEASURED` and the two records are not asserted to describe the same file.
- English narration and short English captions remain in the video. The separate Japanese SubRip file was uploaded and YouTube Studio reported the Japanese subtitle track as published.
- Devpost project `1405191` has visible page title and heading `Kyoto Booking Retry Proof`. Version 8 aligned the hotel description to 153 Node tests, version 9 unified the technologies, links, and video, version 10 formatted the opening formula and retry-result list, and version 11 added the four-step 60-second check. A cache-bypassed anonymous HTML readback still returned Open Graph title `未定` and Devpost's default Open Graph image, so association of the uploaded hotel image with the public project remains `INCONCLUSIVE`. Current project readback retains state `published`, the public video, and WebMCP Challenge `submitted_at: null`.
- Individual, Japan, Existing, Significant, and Yes are ready as the required submission answers. Final Devpost submission has not occurred; only the explicit final-submit action remains pending.
- Pull request 53 was merged into `main`, so the public repository root now contains the hotel demo and its verification evidence.
