---
title: "Fictional Kyoto booking retry — review video storyboard"
information_uuid_v5: "acd0a98e-d1f7-56d8-b71b-04a260ea0b74"
event_uuid_v7: "01a04b22-d9b8-7ae6-8779-6bf9dd7e784c"
occurred_at: "2026-08-29T01:29:30Z"
state: "DRAFT"
state_transition: "NOT_AUTHORED -> SCRIPT_DRAFTED"
---

# Review video storyboard

<!-- machine-contract: The finished video MUST remain under 180 seconds, contain audible English narration, keep actual unmodified site recording at or above 70 percent, disclose every generated scene, and make no claim of a public deployment without a same-session readback. -->

## Locked result

- Planned length: **165 seconds (2 minutes 45 seconds)**.
- Planned actual site recording: **145 seconds (87.9%)**. This is a plan, not a measured final result; measure the exported file before publication.
- Generated dramatization: **20 seconds (12.1%)**, followed by actual site recording through the final frame.
- Canvas: 16:9 at 1920 by 1080 pixels.
- Language: English narration and short burned-in English captions. The separate Japanese subtitle file is for the video host.
- The actual site recording must not pass through a generated-video or image-enlargement service.
- Use no real hotel, real traveler, personal information, payment detail, address, airline mark, hotel mark, or service logo.

## Timeline

| Time | Picture and exact action | Evidence to keep visible | Narration |
|---|---|---|---|
| 0:00–0:10 | Use the nine-second Higgsfield airport-connection scene, then hold its last frame for one second. Keep the fictional traveler and phone generic. | Keep `AI-generated dramatization / Fictional booking` visible in the upper-left for the full shot. | 01 |
| 0:10–0:20 | Use the six-second Higgsfield duplicate-alert scene, then hold its last frame for four seconds. Show concern, not panic. | Keep the same disclosure visible. Do not show readable booking, hotel, airline, or personal data. | 02 |
| 0:20–0:35 | Cut to the actual site with the first question and the fictional-only notice in view. Do not use a generated transition. | `Did my hotel booking go through?`, `Fictional Kyoto Ryokan`, and the device-and-deployment storage notice. | 03 |
| 0:35–0:50 | Enter the dates, adults, and rooms at normal speed. Pause on the price and cancellation preview. | One to fourteen nights, no more than two adults per room, 12,000 yen per room per night, and preview-only cancellation terms. | 04 |
| 0:50–1:05 | In the real ChatGPT Sites recording, discover and run `check_existing_hotel_booking`, then run `prepare_hotel_booking`. If a live Sites run is unavailable, do not imitate one; label that portion unmeasured and record the local page instead. | The same normalized request, no existing booking, `PREPARED`, and the 120-second approval window. | 05 |
| 1:05–1:20 | Keep the four-tool list visible, then use the page's visible human confirmation button. | Show that `check_existing_hotel_booking`, `prepare_hotel_booking`, `get_hotel_booking_status`, and `preview_hotel_cancellation` are the only WebMCP tools. No confirmation, payment, or cancellation-changing tool exists. | 06 |
| 1:20–1:35 | Show `COMMITTED` and the lost-success-response message. Reload once and briefly disconnect the page only if the service worker already controls the built page. | One stored simulated booking, one effect start, hidden confirmation response, and recovered local state after reload. | 07 |
| 1:35–1:45 | Run `get_hotel_booking_status`, use the safe retry control, and briefly show `preview_hotel_cancellation`. | `2 attempts → 1 simulated booking → 1 confirmation number`; the cancellation preview must not change state. | 08 |
| 1:45–1:55 | Zoom only with the browser's normal zoom control to the normalized request and stable identity evidence. | One UUIDv5 for hotel, plan, dates, adults, and rooms; display language excluded. | 09 |
| 1:55–2:05 | Show the verified two-tab and repeated-click result card or its local evidence panel. | Unique booking details, unique confirmation number, one stored result. | 10 |
| 2:05–2:15 | Show the event evidence and count cards without exposing developer secrets or local paths. | UUIDv7 state events, SHA-256 forward chain, and effect-start count `1`. | 11 |
| 2:15–2:25 | Scroll to the actual service-state table. | Installation, sign-in, publication, and runtime confirmation remain separate fields. | 12 |
| 2:25–2:35 | Keep the service table on screen and read its current values. Never replace an unknown value with success. | ChatGPT Sites is the intended primary home; Vercel is the backup. A local build does not prove either current deployment. | 13 |
| 2:35–2:45 | Return to the actual one-booking result. Overlay a small closing title without covering the counts or confirmation result. | One safe answer, one simulated booking, no real charge. Keep the site recording visible behind the title. | 14 |

## Recording order

1. Start from a clean browser profile and record the page before creating any local booking.
2. Keep the browser address, deployment scope notice, four tool names, state, attempt count, booking count, and effect-start count readable at 1080 pixels.
3. Use the visible human button for the only simulated commit. Do not invoke a hidden function or edit browser storage.
4. Record the live service table only after its same-session status check. If ChatGPT Sites, Vercel, or another service has not been verified, leave it visibly unmeasured.
5. Record a separate clean take for narrow screens; use the 16:9 desktop take in the review video unless the narrow-screen evidence is needed.

## Assembly gates

- Replace the provisional subtitle times only after the final narration exists. Word timing must come from the final audio, then the authored wording may replace recognized words.
- Keep burned-in captions to one short line, at most three words and fifteen characters where practical, near the bottom without covering controls.
- Verify the final duration is below 180 seconds, audio is present, the planned 145 seconds of site recording survived the edit, and the first 20 seconds retain the exact generated-scene disclosure.
- Keep publication at `NOT_STARTED`, `DRAFT`, or `PRIVATE` until the owner separately approves a public video. Do not upload from this workflow.
