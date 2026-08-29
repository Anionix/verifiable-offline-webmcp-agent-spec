---
title: "Fictional Kyoto booking retry — review video storyboard"
information_uuid_v5: "acd0a98e-d1f7-56d8-b71b-04a260ea0b74"
event_uuid_v7: "01a04bcc-cd86-72c0-ae81-152d7c74d51d"
occurred_at: "2026-08-29T04:35:08Z"
state: "FINAL"
state_transition: "NOT_AUTHORED -> SCRIPT_DRAFTED -> AUDIO_GENERATED -> SUBTITLES_AUDIO_TIMED -> VIDEO_ASSEMBLY_PENDING -> PUBLIC_SITE_RECORDED -> FINAL_VIDEO_VERIFIED"
---

# Review video storyboard

<!-- machine-contract: The finished video MUST remain under 180 seconds, contain audible English narration, keep actual unmodified site recording at or above 70 percent, disclose every generated scene, and make no claim of a public deployment without a same-session readback. Audio timing does not prove that the final video exists or passed review. -->

## Current measured plan

- Measured English narration: **148.192625 seconds**.
- Measured final length: **150 seconds (2 minutes 30 seconds)**.
- Generated dramatization: **20 seconds (13.3%)**, from 0:00 through 0:20.
- Measured actual public-site recording: **130 seconds (86.7%)**, from 0:20 through 2:30, assembled from a 70-second interaction take and a 60-second proof-table take.
- English and Japanese subtitle timing is aligned to the measured narration. The English captions are burned into the final video; the Japanese SubRip file remains separate for the video host.
- Canvas: 16:9 at 1920 by 1080 pixels.
- Language: English narration and short burned-in English captions. The separate Japanese subtitle file is for the video host.
- The actual site recording must not pass through a generated-video or image-enlargement service.
- Use no real hotel, real traveler, personal information, payment detail, address, airline mark, hotel mark, or service logo.

## Timeline

| Time | Picture and exact action | Evidence to keep visible | Narration |
|---|---|---|---|
| 0:00–0:10 | Use the nine-second Higgsfield airport-connection scene, then hold its last frame for one second. Keep the fictional traveler and phone generic. | Keep `AI-generated dramatization / Fictional booking` visible in the upper-left for the full shot. | 01 |
| 0:10–0:20 | Use the six-second Higgsfield duplicate-alert scene, then hold its last frame for four seconds. Show concern, not panic. | Keep the same disclosure visible. Do not show readable booking, hotel, airline, or personal data. | 02 |
| 0:20–0:36 | Cut to the actual site with the first question and the fictional-only notice in view. Do not use a generated transition. | `Did my hotel booking go through?`, `Fictional Kyoto Ryokan`, and the device-and-deployment storage notice. | 03 |
| 0:36–0:47 | Enter the dates, adults, and rooms at normal speed. Pause on the price and cancellation preview. | One to fourteen nights, no more than two adults per room, 12,000 yen per room per night, and preview-only cancellation terms. | 04 |
| 0:47–1:00 | In the real ChatGPT Sites recording, discover and run `check_existing_hotel_booking`, then run `prepare_hotel_booking`. If a live Sites run is unavailable, do not imitate one; label that portion unmeasured and record the local page instead. | The same normalized request, no existing booking, `PREPARED`, and the 120-second approval window. | 05 |
| 1:00–1:12 | Keep the four-tool list visible, then use the page's visible human confirmation button. | Show that `check_existing_hotel_booking`, `prepare_hotel_booking`, `get_hotel_booking_status`, and `preview_hotel_cancellation` are the only WebMCP tools. No confirmation, payment, or cancellation-changing tool exists. | 06 |
| 1:12–1:23 | Show `COMMITTED` and the lost-success-response message. Reload once and briefly disconnect the page only if the service worker already controls the built page. | One stored simulated booking, one effect start, hidden confirmation response, and recovered local state after reload. | 07 |
| 1:23–1:30 | Run `get_hotel_booking_status`, use the safe retry control, and briefly show `preview_hotel_cancellation`. | `2 attempts → 1 simulated booking → 1 confirmation number`; the cancellation preview must not change state. | 08 |
| 1:30–1:42 | Zoom only with the browser's normal zoom control to the normalized request and stable identity evidence. | One UUIDv5 for hotel, plan, dates, adults, and rooms; display language excluded. | 09 |
| 1:42–1:51 | Show the verified two-tab and repeated-click result card or its local evidence panel. | Unique booking details, unique confirmation number, one stored result. | 10 |
| 1:51–2:01 | Show the event evidence and count cards without exposing developer secrets or local paths. | UUIDv7 state events, SHA-256 forward chain, and effect-start count `1`. | 11 |
| 2:01–2:11 | Scroll to the actual service-state table. | Installation, sign-in, publication, and runtime confirmation remain separate fields. | 12 |
| 2:11–2:19 | Keep the service table on screen and read its current values. Never replace an unknown value with success. | ChatGPT Sites is the intended primary home; Vercel is the backup. A local build does not prove either current deployment. | 13 |
| 2:19–2:30 | Return to the actual one-booking result. Overlay a small closing title without covering the counts or confirmation result. | One safe answer, one simulated booking, no real charge. Keep the site recording visible behind the title. | 14 |

## Recording order

1. The actual public Site was recorded from an empty origin before creating the fictional local booking.
2. Keep the browser address, deployment scope notice, four tool names, state, attempt count, booking count, and effect-start count readable at 1080 pixels.
3. Use the visible human button for the only simulated commit. Do not invoke a hidden function or edit browser storage.
4. Record the live service table only after its same-session status check. If ChatGPT Sites, Vercel, or another service has not been verified, leave it visibly unmeasured.
5. Record a separate clean take for narrow screens; use the 16:9 desktop take in the review video unless the narrow-screen evidence is needed.

## Assembly gates

- English and Japanese subtitle timing is aligned to the measured narration. English cues were rendered into the assembled video; Japanese cues remain a separate upload file.
- Keep burned-in captions to one short line, at most three words and fifteen characters where practical, near the bottom without covering controls.
- Verified: 150 seconds, audible stereo audio, 130 seconds of actual public-site recording, 86.7 percent actual-site share, and the exact generated-scene disclosure throughout the first 20 seconds.
- The final video is assembled and locally verified at 1920 by 1080 pixels. It is intentionally not uploaded or published yet.
- Keep publication at `NOT_STARTED`, `DRAFT`, or `PRIVATE` until the owner separately approves a public video. Do not upload from this workflow.
