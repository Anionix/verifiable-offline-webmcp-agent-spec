---
title: "Kyoto Booking Retry Proof — release guide"
language: "ja-en"
information_uuid_v5: "14f8eb1a-a861-59e4-a2a1-1a5b2a0114d6"
event_uuid_v7: "01a050c7-3406-7a09-b8ea-f08a051a2cd6"
state_transition: "UNPACKAGED_DEMO -> JUDGE_READY_RELEASE_GUIDE"
occurred_at: "2026-08-30T04:20:00Z"
status: "release-guide"
---

# Kyoto Booking Retry Proof

**A fictional Kyoto hotel booking stays one booking when the success response disappears.**

Visible proof: `2 attempts → 1 simulated booking → 1 confirmation number`.

## Short Japanese summary / 日本語要約

通信が切れて成功表示だけ消えたとき、同じ京都旅館の予約を再送しても一件に戻る架空デモです。WebMCPは確認・準備・状態取得・取消条件の表示だけを行い、確定は画面上の人間だけが押せます。個人情報、決済、実ホテル、メール、外部予約、実際の取消はありません。

## Open first

- [Primary ChatGPT Site](https://kyoto-booking-retry-proof.anionix.chatgpt.site)
- [60-second result video](https://youtu.be/tdSvJw4ghX8)
- [Devpost project](https://devpost.com/software/project-y79pb23hj1mz)
- [Vercel backup](https://kyoto-booking-retry-proof.vercel.app)
- [English visual guide](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.en.md)
- [日本語の視覚導線](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/25-devpost-visual-guide.ja.md)

## 60-second judge path

1. Select **1. Check and prepare** with the fictional `Fictional Kyoto Ryokan` and `Standard Flexible` plan.
2. Confirm `PREPARED`, then select **2. Confirm booking — human action only**. The simulated booking is saved while the success response is intentionally hidden.
3. Select **Retry the same booking** with the same dates, guests, and rooms.
4. Verify `RETRY_RECOGNIZED`, `attempts 2`, `bookings 1`, `effect starts 1`, and the same confirmation number.

The result is local to this browser and this publication target. ChatGPT Sites and Vercel do not share browser storage.

## What WebMCP exposes

| Capability | Safe purpose | Changes booking state? |
|---|---|---:|
| `check_existing_hotel_booking` | Find the same normalized booking identity. | No |
| `prepare_hotel_booking` | Validate dates, guests, rooms, price, and terms; create a 120-second preparation. | Preparation only |
| `get_hotel_booking_status` | Recover status and confirmation after a lost response. | No |
| `preview_hotel_cancellation` | Show the free-cancellation deadline and estimated fee. | No |

The site never exposes an agent-facing confirmation, payment, or cancellation mutation. Only the visible human button can commit the fictional booking.

## What to look for

- **EMPTY:** no local booking exists.
- **PREPARED:** inputs and the fixed price are checked; human approval is available for 120 seconds.
- **COMMITTED:** one fictional booking is stored, and the success response is hidden to simulate an interruption.
- **RETRY_RECOGNIZED:** the same UUIDv5 identity returns the same confirmation; the counters stay at two attempts, one booking, and one effect start.
- **Proof panel:** UUIDv5 identity, UUIDv7 latest event, event count, and SHA-256 chain validity remain visible.

The price is 12,000 Japanese yen per room per night. Valid input is 1–14 nights, 1–4 adults, and 1–2 rooms, with at most two adults per room. Cancellation terms are displayed only: free until 72 hours before 15:00 on check-in day, then one room-night as the fictional estimate.

## Build and package

From the repository root:

```bash
npm ci
npm run build:web
npm run validate:hotel
npm run release:hotel
npm run validate:hotel:release
```

The shared build creates `dist/client/**` for static hosts, `dist/server/index.js` and `dist/.openai/hosting.json` for the Sites package, and a reproducible release directory at `release/kyoto-booking-retry-proof/`. The release directory contains this README, the visual guides, the release guide, `LICENSE`, all three built trees, `release-manifest.json`, and `SHA256SUMS`; it never contains video binaries, environment files, credentials, or personal information.

## Evidence and limits

The source repository keeps the detailed [hotel verification record](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/hotel-booking-verification.json), [video production record](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/demo-video-production.json), [public readback](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/metadata/devpost-public-readback.json), and [release instructions](https://github.com/Anionix/verifiable-offline-webmcp-agent-spec/blob/main/docs/24-hotel-release-package.en.md). The connected Chrome page did not expose the standard native WebMCP surface, so broad Chrome-native discovery remains `INCONCLUSIVE`; the bounded in-app result is the evidence shown in the video. Physical keyboard and screen-reader runs remain `INCONCLUSIVE`, and the local video file to public YouTube identity remains `UNMEASURED`.

This is an educational, fictional, device-local proof of safe retry behavior. It does not contact a hotel, airline, payment service, mail service, or booking provider.
