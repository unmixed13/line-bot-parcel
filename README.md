# line-bot-parcel

LINE Bot for Smart Parcel Box.

This repo currently holds **two backends**:

| Path | Stack | Status |
|------|-------|--------|
| repo root (`index.js`, `line.js`, `adafruit.js`) | Node.js / Express | Current production bot — ESP32 polls `/command` and `/sensor` |
| [`smart_iot_parcel_box/`](./smart_iot_parcel_box) | Python / FastAPI | More advanced reference backend (MQTT, DB-backed audit log, live dashboard) — not wired to the deployed ESP32 firmware yet |

They are independent services with different device contracts (HTTP polling
vs. MQTT). Don't run both against the same physical box without updating the
firmware to match whichever one it's talking to.

## ⚠️ Rotate your secrets

Earlier commits in this repo's history hardcoded a real LINE channel access
token and Adafruit IO key directly in `index.js`/`line.js`/`adafruit.js`.
Removing them from the current code (done in this change) does **not** remove
them from git history — anyone with read access to this repo can still see
them in old commits. If you haven't already:

1. Regenerate the LINE channel access token in the LINE Developers Console.
2. Regenerate/revoke the Adafruit IO key at io.adafruit.com.
3. Put the new values only in environment variables (`.env`, or your host's
   dashboard) — never in code.

## Node.js bot (repo root)

```bash
npm install
cp .env.example .env   # fill in LINE_CHANNEL_ACCESS_TOKEN at minimum
npm start
```

### Environment variables

See `.env.example` for the full list. Summary:

- `LINE_CHANNEL_ACCESS_TOKEN` — **required**, the bot won't start without it.
- `LINE_CHANNEL_SECRET` — recommended; enables `X-Line-Signature` verification
  on `/webhook` so forged requests are rejected. A startup warning is logged
  if it's unset.
- `DEVICE_API_KEY` — recommended; if set, the ESP32 must send it as header
  `X-API-Key` (or `?key=`) to call `/command` / `/sensor`. Left unset, those
  endpoints stay open to anyone who finds the URL (a startup warning is
  logged either way).
- `ADAFRUIT_IO_USERNAME` / `ADAFRUIT_IO_KEY` — optional, only used if
  `adafruit.js` is wired back into `index.js`.

### What changed in this security/stability pass

- Removed all hardcoded secrets — everything comes from environment
  variables now, validated at startup (fails fast if the LINE token is
  missing, warns if the signature/device-key protections are left off).
- `/webhook` now verifies LINE's `X-Line-Signature` (HMAC-SHA256, constant
  time) instead of trusting any POST body blindly, and processes every event
  in a batch instead of only `events[0]`.
- `/command` and `/sensor` can now require a shared device API key.
- Added rate limiting (`express-rate-limit`) and security headers (`helmet`).
- Added a centralized JSON error handler so a malformed request body returns
  a clean `400` instead of an Express stack trace.
- `userIds.json` is now written via a temp-file-then-rename instead of a
  direct overwrite, so a crash mid-write can't corrupt it.
- Added graceful shutdown (`SIGTERM`/`SIGINT`) and process-level
  `uncaughtException`/`unhandledRejection` logging so the process doesn't die
  silently or leave connections hanging on redeploy.
- Added `/health` for uptime monitoring.
- `index.js` now reuses `line.js` instead of duplicating the LINE API calls
  (and its own copy of the hardcoded token).

## Python/FastAPI backend (`smart_iot_parcel_box/`)

See [`smart_iot_parcel_box/README.md`](./smart_iot_parcel_box/README.md) for
full architecture docs. It was reviewed and hardened as part of this same
pass: a separate, token-gated auth for the live dashboard WebSocket
(previously open to anyone), a per-IP rate limiter on the device-facing API,
and startup warnings for the most common production misconfigurations
(debug mode left on, placeholder API key, missing dashboard token).
