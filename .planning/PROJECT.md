# AI Habit Quest

## What This Is

A gamified habit-tracker delivered as a Telegram Mini App. The user picks a goal (sport, study, discipline, custom), an AI module produces a 7-day plan of small daily tasks, and the app rewards completion with streaks, XP, and badges. The free tier is intentionally narrow (1 goal, 3 habits, 7-day plan); paid Premium unlocks unlimited goals, 30-day AI plans, AI coaching, advanced stats, streak recovery, and closed challenges.

This is the first product on a shared Mini-App platform: the core (auth, gamification, plan engine, AI port, payments, notifications, admin) will later host **AI Focus** (anti-procrastination) and **AI Study Quest** (study planner) without rewriting from scratch.

## Core Value

> A user picks a goal, sees a personalised 7-day plan, and feels measurable progress on day 1. Everything else (payments, AI quality, admin, marketing) exists to protect that loop.

If the day-1 loop is broken or boring, no other feature matters.

## Context

- **Audience:** RU/CIS first (RU language default, EN available); expansion via Telegram Stars later.
- **Channel:** Telegram Mini App — auth via `Telegram.WebApp.initData`, payments via YooKassa (recurring card) for CIS and Telegram Stars for global digital goods.
- **AI:** local open-weight model (Qwen 3-4B or Gemma 4 E2B/E4B) via Ollama, fronted by a small FastAPI service. v1 ships a deterministic stub by category to remove a launch-blocker.
- **Hosting target:** Timeweb Cloud or equivalent VPS; ai-service needs GPU or 4-bit quantisation.
- **Legal:** self-employed / sole proprietor (РФ), public offer + privacy policy required, ФЗ-152 minimum-data principle, no medical/financial guarantees.
- **Trends informing scope:** gamified Telegram Mini Apps with daily quests + rewards (Gift Fest pattern) and AI personalisation drive both retention and willingness to pay.

## Requirements

### Validated

(None yet — ship to validate.)

### Active

- [ ] Telegram WebApp `initData` authentication with HMAC verification
- [ ] Goal creation with category templates (sport / study / discipline / custom)
- [ ] 7-day plan generation via pluggable AI port (stub by default, Ollama provider available)
- [ ] Daily tasks (max 3/day) with done/not-done toggle and undo
- [ ] Streak counter, XP, level, basic badges
- [ ] Telegram bot reminders at user-selected time
- [ ] Free-tier limits enforced (1 goal, 3 habits, 7-day horizon)
- [ ] Subscription screen with offer text and entrypoint (YooKassa link + Stars invoice placeholder)
- [ ] YooKassa: first-payment with card-binding for autocharges + monthly recurring charge
- [ ] Telegram Stars: invoice creation for digital goods (Premium)
- [ ] Admin panel: user list, subscription status, manual Premium activation, basic-auth gate
- [ ] Docker Compose for backend + web + postgres + ai-service
- [ ] RU/EN i18n on the web client
- [ ] Referral program: invite link → +N days Premium for inviter

### Out of Scope (v1)

- AI Focus and AI Study Quest products — same core, separate launch
- Real GPU-backed inference on production — staging with Ollama on dev box; production swap deferred until DAU justifies cost
- Social challenges with leaderboards — Premium hook, post-v1
- Mobile-native apps — Mini App only
- Health/financial advice — disclaimer surfaces this is a self-organization tool
- Toncoin payout integration — after Stars revenue is non-trivial

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| NestJS + TypeScript backend (monorepo with Vite/React web) | One language across server + client; NestJS modular DI maps cleanly to the Auth/User/Plan/Tasks/Payments/Notifications/Admin/Bot modules described in the brief. | — Locked |
| Prisma over TypeORM | Faster iteration, single schema source of truth, first-class migrations on Windows/Docker. | — Locked |
| AI as separate FastAPI service (Python), not in-process | Lets us scale or replace inference independently; v1 ships a stub provider so launch doesn't block on model ops. | — Locked |
| Stub AI by category for v1 | Deterministic, free, removes the highest-variance dependency from launch. Real Ollama swap is a config flip (`AI_PROVIDER=ollama`). | — Locked |
| YooKassa first, Telegram Stars right after | YooKassa supports recurring card autopayments for CIS subscribers; Stars is mandatory for digital goods cross-border. | — Locked |
| Coarse phase granularity, vertical-MVP mode | We want a working day-1 loop on the shortest path. Roadmap follows the 30-day plan in the brief. | — Locked |
| Free tier = 1 goal / 3 habits / 7-day plan | Matches the brief; gives Premium clear, defensible value (unlimited goals + 30-day AI plan + coaching). | — Locked |
| Local AI via Ollama (Qwen 3-4B or Gemma 4 E2B/E4B), Apache 2.0 | Open licence, no per-call API cost, latency low enough for daily plan generation. | — Locked |
| Bot token leaked in chat during setup | Must be revoked in @BotFather and replaced before any public testing. | — Pending action |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-27 after initialization*
