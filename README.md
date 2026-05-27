# AI Habit Quest

Gamified habit-tracking Telegram Mini App with AI-generated 7/30-day plans, streaks, XP, and Premium subscription.

This repo is a monorepo with four services:

| Path | Stack | Role |
|------|-------|------|
| `backend/` | NestJS + TypeScript + Prisma + Postgres + grammy | HTTP API, Telegram bot, scheduler, payments, admin |
| `web/` | React 18 + Vite + TypeScript + Tailwind + `@twa-dev/sdk` | Telegram Mini App UI |
| `ai-service/` | Python 3.12 + FastAPI + Ollama client | `/generate-plan` — v1 stub, v2 Qwen 3-4B / Gemma 4 |
| `docker-compose.yml` | — | One-command dev stack |

Detailed plan, requirements, and roadmap live in [`.planning/`](.planning/).

## Quickstart (dev)

> Prereqs: Docker Desktop, Node ≥ 20, Git. Optional: [Ollama](https://ollama.com) on the host machine if you want real AI instead of the stub.

```powershell
# 1. Clone and enter the project
cd C:\ai-habit-quest

# 2. Configure secrets
Copy-Item .env.example .env
# Edit .env: set TELEGRAM_BOT_TOKEN (from @BotFather), JWT_SECRET, admin password.

# 3. Bring everything up
docker compose up --build
```

Services:

- Backend API → http://localhost:3001
- Web Mini App (dev image) → http://localhost:5173
- AI service → http://localhost:8000 (`/docs` for Swagger)
- Postgres → localhost:5432 (user/password/db from `.env`)

To run backend or web outside Docker (faster hot reload):

```powershell
# In one terminal — start postgres + ai-service in containers only
docker compose up postgres ai-service

# In another terminal — backend
npm install
npm --workspace backend run prisma:migrate
npm run dev:backend

# In another terminal — web
npm run dev:web
```

## Telegram bot setup

1. Talk to [@BotFather](https://t.me/BotFather), create a bot, copy the token to `TELEGRAM_BOT_TOKEN`.
2. `/newapp` in @BotFather, attach the Mini App URL (`http://localhost:5173` in dev, your https URL in prod).
3. Set `TELEGRAM_BOT_USERNAME` (without `@`) and `VITE_TG_BOT_USERNAME` so the referral link can be generated.
4. For production, set `TELEGRAM_WEBHOOK_URL` to your `/telegram/webhook` https endpoint.

> **Security:** if a token has ever appeared in chat, a screenshot, or a commit, revoke it in @BotFather and replace it.

## Switching the AI provider to Ollama

```powershell
# On the host: install Ollama and pull a model
ollama pull qwen3:4b      # or gemma3:4b

# In .env
AI_PROVIDER=ollama
OLLAMA_MODEL=qwen3:4b

# Restart ai-service
docker compose up -d --force-recreate ai-service
```

The stub provider stays as automatic fallback when Ollama is unreachable.

## Repository layout

```
ai-habit-quest/
├── .planning/             # PROJECT, REQUIREMENTS, ROADMAP, research notes
├── backend/               # NestJS API + bot + scheduler
├── web/                   # React Mini App
├── ai-service/            # FastAPI plan generator
├── docker-compose.yml
├── .env.example
└── README.md
```

## Deploying to Timeweb Cloud (GitHub → Dockerfile, auto-deploy on push)

Full step-by-step is in [`.planning/DEPLOY-TIMEWEB.md`](.planning/DEPLOY-TIMEWEB.md). Short version:

1. Push the repo to GitHub.
2. Create 3 Timeweb **Apps** (one per service) pointed at the same repo with different `Project directory` values: `backend`, `web`, `ai-service`. Build type = **Dockerfile**, branch = `main`, auto-deploy ON.
3. Create 1 Timeweb **Managed PostgreSQL** (`Cloud DB 1/2/20`, ~450 ₽/mo); paste its DSN into the backend App's `DATABASE_URL` env var.
4. Set the other env vars per service (full table in the deploy guide).
5. Paste the web App's HTTPS tech domain into @BotFather → menu button → URL.

Push to `main` → all three Apps rebuild automatically. MVP cost: ~1300 ₽/mo (no GPU needed; AI runs in stub mode by default).

For real on-prem LLM inference (Qwen3-4B / Gemma 3-4B via Ollama) you'll need a separate Timeweb **GPU VPS** later — instructions in the same guide. Switching is a one-env-var flip with no code change.

## Next steps

The roadmap is in [`.planning/ROADMAP.md`](.planning/ROADMAP.md). Phase 1 ships the day-1 loop (auth → goal → 7-day plan). Phase 3 adds YooKassa and Telegram Stars — that's when you'll need:

- YooKassa `shopId` and `secretKey` (test or production)
- A public HTTPS URL for Telegram WebApp + bot webhooks (Timeweb gives you `*.twc1.net` for free; production custom domain later)
