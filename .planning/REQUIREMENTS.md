# Requirements — AI Habit Quest v1

REQ-ID format: `[CATEGORY]-[NN]`. Categories: AUTH, GOAL, PLAN, TASK, GAME, NOTIF, PAY, ADMIN, INFRA, I18N, REF.

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01** — User can open the Mini App via the Telegram bot and be authenticated automatically through `Telegram.WebApp.initData`, with the backend verifying the HMAC signature against `TELEGRAM_BOT_TOKEN`.
- [ ] **AUTH-02** — Backend persists a `User` row keyed by `telegram_id` on first launch (display name, language, premium status defaults).
- [ ] **AUTH-03** — Server issues a short-lived session JWT after successful initData verification; subsequent API calls require it.
- [ ] **AUTH-04** — initData older than 24h is rejected.

### Goals & Habits (GOAL)

- [ ] **GOAL-01** — User can create one active goal from a category template: `sport`, `study`, `discipline`, or `custom` with free-text title.
- [ ] **GOAL-02** — Free-tier users are blocked from creating a second active goal; UI surfaces a Premium CTA.
- [ ] **GOAL-03** — User can attach up to 3 habits to the active goal (free tier); Premium lifts the cap.
- [ ] **GOAL-04** — User can archive (soft-delete) a goal; archived goals don't count toward the free-tier limit.

### Plan generation (PLAN)

- [ ] **PLAN-01** — On goal creation the backend requests a plan from the AI port: `POST /generate-plan { category, level, horizon_days }` → JSON of daily habits and tasks.
- [ ] **PLAN-02** — AI port has two providers: `stub` (deterministic per-category plans for v1) and `ollama` (Qwen3-4B / Gemma 4 via Ollama). Provider chosen by `AI_PROVIDER` env.
- [ ] **PLAN-03** — Free tier returns a 7-day plan; Premium returns 30 days.
- [ ] **PLAN-04** — Plans are cached server-side by `(category, level, horizon_days)` to avoid recomputing for identical inputs.

### Daily tasks (TASK)

- [ ] **TASK-01** — Backend materialises the next day's tasks (max 3) from the active plan each midnight in the user's timezone.
- [ ] **TASK-02** — User can mark a task done / undo within the same calendar day.
- [ ] **TASK-03** — Marking a task done awards XP; the day counts toward streak only if at least one task is done.
- [ ] **TASK-04** — API exposes `GET /tasks/today` and `POST /tasks/:id/toggle`.

### Gamification (GAME)

- [ ] **GAME-01** — Each user has `streak_current`, `streak_best`, `xp_total`, `level` (level = floor(sqrt(xp / 50))).
- [ ] **GAME-02** — Missing a full day breaks the streak; Premium can restore the most recent broken streak once per 7 days.
- [ ] **GAME-03** — Badges are awarded at 3-, 7-, 14-, 30-day streaks and at level 5 / 10.
- [ ] **GAME-04** — Progress screen shows current streak, level, XP, last-7-day completion bar.

### Notifications (NOTIF)

- [ ] **NOTIF-01** — User picks a daily reminder time (default 09:00 user-local); backend schedules a Telegram Bot message via cron.
- [ ] **NOTIF-02** — Reminder is skipped if the user already completed all today's tasks.
- [ ] **NOTIF-03** — Bot `/start` command opens the Mini App via inline button.

### Payments (PAY)

- [ ] **PAY-01** — Subscription screen lists Premium benefits + trial (3 days at 1 ₽) + 299 ₽/month for RU.
- [ ] **PAY-02** — YooKassa: backend creates a payment with `save_payment_method: true`; on success, stores `payment_method_id` for autocharges.
- [ ] **PAY-03** — Monthly cron triggers YooKassa recurring charges; failures notify the user via bot and offer a manual payment link.
- [ ] **PAY-04** — Telegram Stars: backend creates an invoice via `createInvoiceLink` for the Premium SKU; success webhook upgrades the user.
- [ ] **PAY-05** — Premium activation flips `users.is_premium = true` and lifts all free-tier limits immediately.
- [ ] **PAY-06** — User can cancel autorenewal from the Subscription screen; access stays until the paid period ends.

### Admin (ADMIN)

- [ ] **ADMIN-01** — Admin endpoints sit behind HTTP basic auth (`ADMIN_BASIC_USER` / `ADMIN_BASIC_PASSWORD`).
- [ ] **ADMIN-02** — Admin can list users with filters (premium status, last active, country).
- [ ] **ADMIN-03** — Admin can manually grant or revoke Premium for a user.
- [ ] **ADMIN-04** — Admin can view recent payment events and feedback messages.

### Infrastructure (INFRA)

- [ ] **INFRA-01** — `docker compose up` brings up backend, web, postgres, and ai-service on the developer's machine.
- [ ] **INFRA-02** — Prisma migrations run automatically on backend startup in development.
- [ ] **INFRA-03** — Health endpoints: `GET /health` (backend) and `GET /healthz` (ai-service).
- [ ] **INFRA-04** — `.env.example` is committed; `.env` is gitignored; secrets never enter the repo.

### i18n (I18N)

- [ ] **I18N-01** — Web client supports RU (default) and EN; language sourced from `Telegram.WebApp.initDataUnsafe.user.language_code` with manual override.
- [ ] **I18N-02** — Backend stores user language and uses it for bot messages.

### Referrals (REF)

- [ ] **REF-01** — Each user has a unique referral link (`t.me/<bot>?start=ref_<userId>`).
- [ ] **REF-02** — A new user joining via a referral grants the inviter 3 days of Premium (cap: 30 days/month).

## v2 / Deferred

- Closed challenges with leaderboards
- AI coaching dialog (chat-style guidance)
- Detailed analytics dashboard with retention curves for users
- Streak-share cards (image generation)
- Toncoin payout for Stars revenue
- AI Focus and AI Study Quest products on the same core
- Mobile push (outside Telegram)

## Out of Scope (v1) — rationale

- **Medical / financial advice** — legal risk; PROJECT.md disclaims this explicitly.
- **Real production GPU inference** — not blocking value; staging Ollama is enough until paying DAU justifies cost.
- **Granular role-based admin** — basic auth is enough at this scale; richer roles when team grows.

## Definition of Done (v1)

- All v1 REQ-IDs pass acceptance checks (manual UAT documented per phase).
- `docker compose up` works on a clean Windows + WSL2 / macOS / Linux machine.
- No secrets in the repo; `.env.example` complete.
- Privacy policy and public offer linked from the Subscription screen.
- Bot token in production differs from any token shared during development.

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| AUTH-01..04 | Phase 1 | planned |
| GOAL-01..04 | Phase 1 | planned |
| PLAN-01..04 | Phase 2 | planned |
| TASK-01..04 | Phase 2 | planned |
| GAME-01..04 | Phase 2 | planned |
| NOTIF-01..03 | Phase 2 | planned |
| PAY-01..06 | Phase 3 | planned |
| ADMIN-01..04 | Phase 3 | planned |
| INFRA-01..04 | Phase 1 | planned |
| I18N-01..02 | Phase 2 | planned |
| REF-01..02 | Phase 4 | planned |
