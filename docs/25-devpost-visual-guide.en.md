---
title: "Kyoto Booking Retry Proof — Devpost visual guide"
language: "en"
information_uuid_v5: "5a6fb249-361d-5745-953e-faf72130ffe9"
event_uuid_v7: "01a050c7-3441-7930-9b51-a85ca5c5c82f"
state_transition: "TECHNICAL_DESCRIPTION_FIRST -> JUDGE_VISIBLE_PROOF_ROUTE"
public_release_alignment_event_uuid_v7: "01a0573d-8e18-7534-9480-d5f1b43c54d0"
occurred_at: "2026-08-31T09:54:07.000Z"
status: "visual-guide-public-release-aligned"
---

# Devpost visual guide

This guide makes the hotel demo understandable in ten seconds, testable in sixty seconds, and explainable in the 150-second video. The visual story is always:

**problem → human checkpoint → safe retry → proof → boundaries**

Show the result before the implementation details. The demo is a fictional Kyoto hotel booking; it does not contact a hotel or process money.

## Three judge routes

### 10-second skim

Show the title **Kyoto Booking Retry Proof**, the question **Did my hotel booking go through?**, and the result `2 attempts → 1 simulated booking → 1 confirmation number`. Link directly to the [primary ChatGPT Site](https://kyoto-booking-retry-proof.anionix.chatgpt.site).

### 60-second test

1. Select **1. Check and prepare**.
2. Confirm `PREPARED`, then select **2. Confirm booking — human action only**.
3. Use native `get_hotel_booking_status` before retrying; it finds the existing result after the success response is hidden.
4. Select **Retry the same booking** with unchanged dates, guests, and rooms.
5. Point to `RETRY_RECOGNIZED`, attempts `2`, bookings `1`, effect starts `1`, and the unchanged confirmation number.

The short [release README](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/examples/hotel-booking-demo/README.md) is the canonical copy of these steps.

### 150-second video

| Time | Show | Narration goal |
|---|---|---|
| 0:00–0:10 | Higgsfield airport interruption scene with the label **AI-generated dramatization / Fictional booking**. | A lost response can look like a failed booking. |
| 0:10–0:20 | Higgsfield duplicate-notification scene with the same disclosure. | A blind retry can create a second reservation and a difficult cancellation. |
| 0:20–0:36 | Real public Site hero and `EMPTY` state. | Ask the ordinary question before retrying. |
| 0:36–0:47 | Dates, guests, rooms, price, and cancellation preview. | Inputs and terms are checked before preparation. |
| 0:47–1:00 | Four safe tools and `PREPARED` with its 120-second window. | The assistant can check and prepare, not confirm. |
| 1:00–1:12 | Human-only confirmation button. | The traveler remains the final approver. |
| 1:12–1:30 | `COMMITTED`, hidden success response, native status recovery before the visible retry. | The same booking is recognized after uncertainty. |
| 1:30–1:51 | Stable UUIDv5 identity and repeated-click/two-tab result. | Same normalized intent means one simulated booking. |
| 1:51–2:01 | UUIDv7 event, SHA-256 chain, and counters. | The visible proof is time ordered and tamper evident. |
| 2:01–2:22 | Service-state table and honest Sites/Vercel publication labels. | Hosting and integration claims stay separate. |
| 2:22–2:30 | Public Site retry-result capture and end card. | Leave the judge with the one-booking result and limits. |

The [storyboard](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/media/demo-video/storyboard.md) is the detailed timing source. The [public video](https://youtu.be/tdSvJw4ghX8) is under three minutes, includes English audio and captions, and keeps actual public Site recording above seventy percent.

The fresh native WebMCP browser run is a separate local recording and evidence record. The published video is not retroactively described as containing that native run.

## Six capture panels

Capture these panels in order. A panel may be a video frame or a Devpost screenshot, but it must show the named UI state and the action that produced it.

| Panel | Visible UI | Action or narration | Judge takeaway | Alt text |
|---|---|---|---|---|
| `01-hero-empty` | Title, question, booking facts, `EMPTY`, and the four-step result promise. | “The response may be lost; first ask the site.” | The problem is ordinary and concrete. | “Kyoto Booking Retry Proof asks whether a fictional hotel booking went through.” |
| `02-prepared` | `PREPARED`, fixed price, cancellation terms, 120-second expiry, and the human-only button. | “The assistant checked; the traveler decides.” | WebMCP narrows the agent's authority. | “Prepared fictional booking with a separate human confirmation control.” |
| `03-human-confirmation` | The visible **Confirm booking — human action only** control and its explanation. | Click once as a person. | Confirmation is not an agent tool. | “Human-only confirmation button is the sole commit control.” |
| `04-committed-lost-response` | `COMMITTED`, one local booking, hidden-success explanation, and offline/reload note. | “The booking was saved, but the success response disappeared.” | This is the failure mode being repaired. | “Committed local booking with intentionally missing success response.” |
| `05-retry-recognized` | `RETRY_RECOGNIZED`, attempts `2`, bookings `1`, effect starts `1`, same confirmation, proof panel. | Retry unchanged input and read status. | Safe retry converges to one result. | “Retry recognized with two attempts, one simulated booking, and one effect start.” |
| `06-tool-and-service-boundary` | Four tool cards, absent confirm/pay/cancel tools, and service-state table. | “Tools, hosting, and browser observations are separate claims.” | The demo is ambitious but honest about limits. | “Four read/prepare/preview tools beside an explicit service boundary table.” |

## Devpost page order

Use this order so a judge can understand the result without reading the repository first:

1. Hotel screenshot or thumbnail.
2. One-line problem and the visible result.
3. The four-step 60-second test.
4. Why WebMCP helps: named, checked state queries instead of pixel guessing.
5. Human-only confirmation boundary.
6. UUIDv5 identity, IndexedDB uniqueness, retry counters, and SHA-256 proof.
7. Fictional/device-local limits and the honest service-state table.
8. Public Site, Vercel backup, repository, license, and video links.

The local thumbnail is [`docs/assets/devpost-hotel-thumbnail.png`](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/assets/devpost-hotel-thumbnail.png). The complete text draft is [`devpost-submission.md`](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/devpost-submission.md).

## Capture contract

- Record at 16:9, 1920×1080, with controls and UI text readable.
- Use the original public Site recording for the WebMCP evidence. Do not run the recording through a generation or upscaling service.
- Keep captions below controls and away from the proof counters.
- Display **AI-generated dramatization / Fictional booking** on both generated opening scenes.
- Do not show real hotels, real people, addresses, passports, payment details, reservation emails, credentials, or private browser data.
- Do not imply that the generated scene is a real booking screen.
- The retained native Chrome WebMCP record is `PASS` for its tested configuration: HTTPS, `document.modelContext`, the exact four intended tools, zero discovery effects, and status recovery before retry. Do not generalize this bounded result to every Chrome release or treat the public alignment as a new native run.
- Keep the Site, Vercel, Devpost, and YouTube links as separate publication facts; one URL does not prove another.
- Add Japanese subtitles as a separate subtitle file; English remains the primary spoken and burned-in language.

## Official judging alignment

| Official area | Evidence to point at |
|---|---|
| **WebMCP Leverage** | Panels 02, 05, and 06: four narrow tools recover state while confirmation stays human-only. |
| **Execution** | Public Site version 14, current Vercel production release, reproducible release, the matching 194 Node tests, bounded WebMCP evidence, and the 150-second narrated recording. |
| **Potential Impact** | The everyday failure mode: a traveler avoids a second reservation and a confusing cancellation hunt. |
| **Creativity & Ambition** | Local-first recovery, stable identity, unique storage, visible event proof, and explicit authority limits in one small demo. |

## Public references

- [Primary ChatGPT Site](https://kyoto-booking-retry-proof.anionix.chatgpt.site)
- [Vercel backup](https://kyoto-booking-retry-proof.vercel.app)
- [Devpost project](https://devpost.com/software/project-y79pb23hj1mz)
- [Public YouTube video](https://youtu.be/tdSvJw4ghX8)
- [Public source repository](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec)
- [Release README](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/examples/hotel-booking-demo/README.md)
- [Release package guide](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/24-hotel-release-package.en.md)
- [Public release readback](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/hotel-public-release-readback.json)
- [Public release alignment readback](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/public-release-alignment-readback.json)
- [Native WebMCP reconciliation record](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/hotel-native-webmcp-reconciliation.json)
- [Video publication copy](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/media/demo-video/publication-copy.md)

## Short Japanese summary / 日本語要約

- 10秒では題名、質問、`2 attempts → 1 simulated booking → 1 confirmation number`だけを見せます。
- 60秒では「確認と準備 → 人間だけが確定 → 同じ予約を再送 → 一件へ収束」の順です。
- 画面は`EMPTY`、`PREPARED`、人間確認、`COMMITTED`、`RETRY_RECOGNIZED`、四機能とサービス境界の6枚です。
- 生成映像には「AI-generated dramatization / Fictional booking」を表示し、実画面録画を証拠にします。
- 実ホテル、決済、個人情報、実際の取消は扱わず、確認したChrome設定の範囲を超える広い適合は主張しません。
