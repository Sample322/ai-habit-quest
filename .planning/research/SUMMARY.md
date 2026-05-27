# Research Summary — Telegram Mini App, AI habits, gamified retention

Synthesised from the project brief (`AI Habit Tracking Trends.pdf`) plus public docs for Telegram WebApp, YooKassa, Ollama, Qwen 3, and Gemma. Captures the decisions that shape Phase 1–4 plans.

## Stack — what to build with

| Concern | Choice | Why |
|---------|--------|-----|
| Backend | **NestJS + TypeScript** | Modular DI maps 1:1 to the Auth/User/Plan/Tasks/Payments/Notifications/Bot/Admin split; shares language with the client. |
| ORM | **Prisma** | First-class migrations, single source of truth, ergonomic on Windows/WSL2/Docker. |
| DB | **PostgreSQL 16** | Rich relational features (partial indexes, generated columns) used by streak/XP queries. |
| Frontend | **React 18 + Vite + TypeScript + Tailwind** | Tightest dev loop for a small Mini App; Tailwind makes the gamified surface fast to iterate. |
| Telegram client | **`@twa-dev/sdk`** + `Telegram.WebApp` global | Stable thin wrapper around the official `Telegram.WebApp` object, typed for TS. |
| AI runtime | **Ollama** running Qwen 3-4B (Apache 2.0) — Gemma 4 E2B/E4B (Apache 2.0) as drop-in fallback | Open licence; local inference removes per-call cost; both models are reasoning-capable and multilingual. |
| AI server | **FastAPI (Python 3.12)** | Tiny surface, async out of the box, swap-friendly with HuggingFace/Ollama. |
| Payments | **YooKassa** (RU recurring autocharges) + **Telegram Stars** (digital goods, cross-border) | YooKassa supports card binding + recurring charges (`save_payment_method`); Telegram requires Stars for digital goods bought inside Mini Apps. |
| Bot | **`grammy`** (Node) inside the NestJS process, webhook mode in prod / long-poll in dev | Light, typed, no extra process to operate. |
| Admin | NestJS controllers behind HTTP Basic, no dedicated admin SPA in v1 | YAGNI for the v1 user volume. |
| Container | docker-compose (4 services + named volumes for postgres + ollama models) | Same artifact on dev + Timeweb VPS. |

## Features — what users actually expect

**Table-stakes (must have or they bounce):**
- Onboarding that picks a goal in < 30 seconds.
- A visible day-1 plan immediately after onboarding.
- Streak counter and at least one reward signal on task completion.
- Daily reminder at a user-chosen time.
- Subscription screen with a clear price and trial.

**Differentiators (this is what makes Habit Quest different):**
- AI-personalised 30-day plan (Premium).
- Stub plans by category for instant, free, deterministic start.
- AI repair: when a user breaks a streak, the model proposes a smaller next step.
- Closed challenges + Premium-only streak recovery.

**Anti-features (deliberately NOT building in v1):**
- Long onboarding quizzes.
- Forced social feed.
- Health-claim language ("lose 5 kg in a month").
- More than 3 tasks per day — overload kills retention.

## Architecture — how the pieces talk

```
┌───────────────┐    HTTPS (initData, JWT)    ┌──────────────────────┐
│ Telegram      │ ─────────────────────────▶ │ NestJS API           │
│ Mini App      │                            │  - Auth (initData)   │
│ (React/Vite)  │                            │  - Goals/Habits      │
└───────────────┘                            │  - Tasks (cron)      │
                                             │  - Plan service      │ ──▶ ai-service /generate-plan
                                             │  - Gamification      │
                                             │  - Payments          │ ──▶ YooKassa / Telegram Stars
                                             │  - Bot (grammy)      │ ──▶ Telegram Bot API
                                             │  - Admin (basic-auth)│
                                             └─────────┬────────────┘
                                                       │ Prisma
                                                       ▼
                                                ┌──────────────┐
                                                │ PostgreSQL   │
                                                └──────────────┘
```

Build order (Phase 1 first):
1. Postgres + Prisma schema.
2. Auth + User module (the floor for everything else).
3. Goals + Habits CRUD.
4. AI port + stub provider + Plan service.
5. Tasks (cron + endpoints).
6. Gamification (derived).
7. Bot + Notifications.
8. Payments.
9. Admin.
10. Web client mirrors backend, screen by screen.

## Pitfalls — what tends to kill these projects

| Pitfall | Detection | Prevention |
|---------|-----------|------------|
| Trusting `initData` from the client without HMAC verification | Any unauthenticated request with a forged user. | Always re-verify `hash` against `TELEGRAM_BOT_TOKEN` server-side; reject `auth_date` older than 24h. |
| Storing card data ourselves | Out of scope and illegal. | Only store YooKassa's `payment_method_id`; never PAN/CVC. |
| Recurring payment surprises | Users see unexpected charges → chargebacks. | Always send a bot notification before each YooKassa autocharge; let user cancel autorenew from the app. |
| Plan stub feels generic | Users churn on day 2. | Per-category plans tuned to be specific (e.g. sport: warm-up + 10-min walk + 1 set of push-ups), and clearly progressive day-over-day. |
| AI service becomes a hard dependency | Backend errors when Ollama is down. | Plan service has a retry + circuit breaker and falls back to the stub provider when ollama is unreachable. |
| Streak math wrong on TZ transitions | User loses streak overnight. | Materialise daily tasks in the user's timezone, store `tasks.local_date` as a DATE not a TIMESTAMP. |
| Bot reminders spam | Users mute the bot. | One reminder/day max; suppress if all today's tasks already done. |
| Free tier too generous → no conversion | Premium never sells. | Hold the line at 1 goal / 3 habits / 7-day plan; Premium = 30-day AI + coaching + recovery + unlimited goals. |
| Hard-coded Russian copy | Cannot expand beyond CIS. | i18n from day one, even with only RU/EN. |
| Leaked secrets | Bot/account hijack. | `.env` gitignored; `.env.example` committed; rotate any token shared in development chat. |

## Key references

- Telegram Mini Apps: <https://core.telegram.org/bots/webapps>
- Telegram Payments (Stars / digital goods): <https://core.telegram.org/bots/payments-stars>
- YooKassa autopayments: <https://yookassa.ru/docs/support/payments/extra/autopayment>
- Qwen 3-4B (Apache 2.0): <https://huggingface.co/Qwen/Qwen3-4B>
- Gemma 4 announcement: <https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/>
- `@twa-dev/sdk`: <https://github.com/twa-dev/SDK>
- `grammy` Telegram framework: <https://grammy.dev>
