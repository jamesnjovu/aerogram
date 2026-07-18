# Aerogram

A **web-based Telegram client** built on Telegram's MTProto Client API (the same API used by
Telegram's official web clients and by GramJS/Telethon). It supports real login, a chat list,
message history, sending messages, media download, and live incoming messages.

> This is a legitimate third-party client. Use it only with your own account and in line with
> Telegram's Terms of Service. Do not use it for spam, scraping, or automation abuse.

## Architecture

```
Browser (Next.js / React)
   │  REST (actions)  +  WebSocket (live updates via socket.io)
   ▼
Node backend (Fastify)
   • GramJS TelegramClient per user  (MTProto over WSS)
   • encrypted session store (SQLite via node:sqlite)
   • media cache (disk)
   • NewMessage update handler → socket.io push
   ▼
Telegram data centers
```

- **`apps/server`** — Fastify + GramJS backend. Owns the MTProto connection, stores sessions
  **encrypted at rest**, and exposes REST + socket.io. `api_hash` never reaches the browser.
- **`apps/web`** — Next.js 15 (App Router) + React 19 + Tailwind frontend.
- **`packages/shared`** — TypeScript DTOs shared by both apps.

## Prerequisites

- **Node.js ≥ 22** (uses the built-in `node:sqlite`; developed on Node 24).
- A Telegram account and API credentials (`api_id` + `api_hash`).

### Get your `api_id` / `api_hash`

1. Go to <https://my.telegram.org> and log in with your phone number.
2. Open **API development tools** → **Create application**.
3. Copy the `api_id` (a number) and `api_hash` (a string).

## Setup

```bash
npm install

# configure the backend
cp apps/server/.env.example apps/server/.env
# then edit apps/server/.env and fill in API_ID, API_HASH, and generate the secrets:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # SESSION_ENC_KEY
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
```

## Run (development)

```bash
npm run dev
```

- Backend: <http://localhost:4000>
- Frontend: <http://localhost:3000>

Open the frontend, log in with your phone number, enter the code Telegram sends you (and your
2FA password if you have one), and you'll see your chats.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run backend + frontend together |
| `npm run dev:server` | Backend only |
| `npm run dev:web` | Frontend only |
| `npm run typecheck` | Type-check all workspaces |
| `npm test` | Backend unit tests (Vitest) |
| `npm run build` | Build the Next.js frontend for production |

## Deploy with Docker

```bash
cp .env.docker.example .env      # fill in API_ID, API_HASH, secrets, and URLs
docker compose up -d --build
```

- Web: <http://localhost:3000> · Backend: <http://localhost:4000>
- Both containers run from one image; server data (SQLite) and the media cache live in named
  volumes (`aerogram-data`, `aerogram-cache`).
- **Production:** set `NEXT_PUBLIC_API_URL` (the public backend URL — baked into the web bundle at
  build time) and `WEB_ORIGIN` (the public web URL) in `.env`, then rebuild. Put both services
  behind TLS; the session cookie is marked `Secure` automatically when `WEB_ORIGIN` is `https`.

## Notes & limits

- Each logged-in user holds one persistent MTProto connection on the server; idle connections are
  disconnected automatically. This is fine for personal / small deployments.
- Telegram throttles with `FLOOD_WAIT_X`; the backend surfaces the wait time. Don't hammer it.
- Session strings grant full access to your account — keep `SESSION_ENC_KEY` and the SQLite
  database (`apps/server/data/`) safe. Both are git-ignored.
