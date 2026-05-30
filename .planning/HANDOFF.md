# AI Habit Quest — Session Handoff

> **Read this first** if you're picking up the project. It's a concise pointer to current state, live URLs, what works, what's broken, and what to do next.

## Current status — one paragraph

Telegram Mini App **AI Habit Quest** is **live on Timeweb Cloud**: three Apps (backend NestJS, web React+Vite, ai-service Python FastAPI) plus a Managed PostgreSQL, fed by GitHub auto-deploy from `Sample322/ai-habit-quest@master`. The **day-1 user loop works end-to-end** in Telegram: auth via Telegram WebApp `initData` → goal creation → 7-day plan → daily tasks with streak/XP → goal deletion with cascade + gamification recompute. Two outstanding issues block "Phase 2 done": **(a)** real AI plans via OpenRouter currently fall back to a deterministic stub for unclear reasons — diagnostic logging is shipped but a fresh log capture is needed, **(b)** Timeweb's deploy queue periodically stalls and required manual `Stop → Start` or App recreation more than once. CORS, JWT auth, admin Premium, multi-goal aggregation, the AI cache key, and the "white screen" build bug have all been fixed.

## Live infrastructure

### Apps on Timeweb (current domains)

| App | Domain | Status | Notes |
|---|---|---|---|
| `ahq-backend` | `https://sample322-ai-habit-quest-55ff.twc1.net` | Active | NestJS, Prisma, grammy bot, listens on 3001 |
| `ahq-ai` | `https://sample322-ai-habit-quest-71a2.twc1.net` | Active (recreated once) | FastAPI on 8000, OpenAI-compatible client |
| `ahq-web` | `https://sample322-ai-habit-quest-0676.twc1.net` | Active (recreated once after build OOM) | Vite SPA served by nginx on 8080 |
| Managed PostgreSQL | host `188.225.27.176:5432` db `default_db` | Active | TLS required (`sslmode=require`) |

### Other live identities

- Bot in Telegram: `@AI_Habit_Tracking_bot` (token `8638703231:AAFw0lqwXz1hqISinKDmzWFCRXbTc8SUwIc`)
- GitHub: `https://github.com/Sample322/ai-habit-quest` (branch `master`, auto-deploy via Timeweb GitHub app)
- Admin Telegram ID (gets infinite Premium): `888007035`
- OpenRouter account: balance topped up, model `meta-llama/llama-3.1-8b-instruct`

### Required env vars (current expected values)

**`ahq-backend`** — all required for the app to even start are marked ⚠:
- ⚠ `DATABASE_URL` — `postgresql://gen_user:ankavanya1303-@188.225.27.176:5432/default_db?schema=public&sslmode=require`
- ⚠ `JWT_SECRET` — 64-hex random
- ⚠ `TELEGRAM_WEBAPP_BOT_TOKEN` — same as bot token (has fallback to `TELEGRAM_BOT_TOKEN`)
- ⚠ `ADMIN_BASIC_PASSWORD` — needed when hitting `/admin/*`
- `TELEGRAM_BOT_TOKEN` — for bot grammy
- `TELEGRAM_BOT_USERNAME` — `AI_Habit_Tracking_bot`
- `AI_SERVICE_URL` — `https://sample322-ai-habit-quest-71a2.twc1.net`
- `ADMIN_TELEGRAM_IDS` — `888007035`
- `NODE_ENV` — `production`
- `TZ` — `Europe/Moscow`
- `BACKEND_PORT` — `3001`
- `ADMIN_BASIC_USER` — `admin`
- `FREE_MAX_GOALS` — `1`
- `FREE_MAX_HABITS` — `3`
- `FREE_PLAN_HORIZON_DAYS` — `7`

**`ahq-ai`**:
- `AI_PROVIDER` — `openai`
- `OPENAI_BASE_URL` — `https://openrouter.ai/api/v1` (default in code if missing)
- `OPENAI_API_KEY` — `sk-or-v1-b772fda28bc43b...`
- `OPENAI_MODEL` — `meta-llama/llama-3.1-8b-instruct`
- `OPENAI_APP_NAME` — `AI Habit Quest`
- `OPENAI_APP_URL` — `https://sample322-ai-habit-quest-0676.twc1.net`
- `TZ` — `Europe/Moscow`

**`ahq-web`** (build-time, baked into JS bundle by Vite):
- `VITE_API_BASE_URL` — `https://sample322-ai-habit-quest-55ff.twc1.net`
- `VITE_TG_BOT_USERNAME` — `AI_Habit_Tracking_bot`

## What works end-to-end (verified)

- Telegram WebApp `initData` HMAC verification (with `TELEGRAM_BOT_TOKEN` fallback)
- JWT sessions, `/me`, `/me/preferences`
- Goal creation with 4 category templates (sport / study / discipline / custom)
- Plan generation (with cache by `(category, horizon, language, normalised title)`)
- Habits attached to goal automatically
- Daily task materialisation for **all active goals** (multi-goal Premium works)
- Mark task done → XP awarded, streak updated, gamification recomputed
- 4th-goal-not-showing bug **fixed**: `materialiseTodayForUser` runs on goal creation
- Goal deletion with cascade + XP recompute + UI confirmation modal + toast
- Admin Premium grant via `ADMIN_TELEGRAM_IDS` env (idempotent)
- Telegram bot `/start`, `/help`, `/feedback` commands; `successful_payment` handler ready
- Web UI grouped by goal on Today screen, premium polish, RU/EN i18n, dark theme

## What's broken / pending — ordered by urgency

### ✅ 1. AI plans falling back to stub — RESOLVED (session 5, 2026-05-30 23:xx)
**Root cause (proven from backend runtime logs via Timeweb REST API):** the backend's
`AI_SERVICE_URL` had pointed at a **stale ai-service domain (`…e620…`) that stopped
resolving** after the app was recreated. axios got `getaddrinfo ENOTFOUND` → silent
`catch` → `localStubPlan`. That's why ai-service logs showed zero POSTs — the requests
never left the backend. Log evidence:
```
WARN [AiService] ai-service unreachable, falling back to local stub:
     getaddrinfo ENOTFOUND sample322-ai-habit-quest-e620.twc1.net
LOG  [PlansService] plan generated ... provider=stub
```

**Fix:** env `AI_SERVICE_URL` was corrected to the live `…71a2…` (already done in the
panel), and the code was hardened:
- `ai.service.ts` axios `timeout 30s → 90s` (ai-service budgets 60s for the LLM call;
  30s cut off legitimate slow Premium 30-day generations).
- New **`GET /ai/diag`** endpoint: backend-side probe of ai-service reachability + a
  sample generation. Catches a future domain change instantly instead of via stub plans.
- `AiPlanResponse.provider` now includes `'openai'`.

**Verified end-to-end** — `curl https://…55ff…/ai/diag` returns:
`{"sample":{"ok":true,"provider":"openai","scheduleDays":7,"ms":7087}}` → real Llama plan.

**Note:** goals that ALREADY got a stub plan keep it (stored in `Plan` table; the cache
only ever stored non-stub). Only **new** goals get a real plan. Delete + recreate any old
stub goals to refresh them.

**Deploy-pipeline fix (same session):** deploys were chronically marked "failed" because
the runtime Docker image shipped the full `node_modules` (typescript, webpack via
`@nestjs/cli`, ts-loader, …) → registry pull took ~4.5 min and blew Timeweb's deploy
window even though the container started fine. `backend/Dockerfile` now runs
`npm prune --omit=dev` after build (and `prisma` moved to prod deps since the startup CMD
runs `prisma db push`). Slim image now deploys cleanly.

**How to drive Timeweb now:** the `timeweb` MCP server is NOT functional (spawn npx
ENOENT) and has no log/deploy tools anyway. Use the **REST API directly** with the
`TIMEWEB_TOKEN` from `~/.claude.json` — it works:
- list apps: `GET https://api.timeweb.cloud/api/v1/apps` (backend id `200081`, ai `201299`, web `201439`)
- runtime logs: `GET /api/v1/apps/{id}/logs?limit=2000` → `{app_logs:[...]}`
- deploy list: `GET /api/v1/apps/{id}/deploys`
- deploy logs: `GET /api/v1/apps/{id}/deploy/{deploy_id}/logs`
- trigger redeploy: `POST /api/v1/apps/{id}/deploy` body `{"commit_sha":"<40-hex>"}`

### 🟡 2. Telegram Stars payment integration not yet tested end-to-end
**Code is ready** (`bot.service.ts` listens for `pre_checkout_query` + `:successful_payment`, calls `payments.handleStarsSuccessFromBot`), but `TELEGRAM_STARS_ENABLED=false` in backend env. Owner currently has admin Premium so no need yet. To activate: flip env to `true` + redeploy backend + buy 250 Stars in BotFather → test invoice.

### 🟡 3. YooKassa integration is stubbed
`yookassa.provider.ts` returns mock URLs when credentials missing. When the user registers as self-employed / IP and gets a YooKassa shop, plug in `YOOKASSA_SHOP_ID` + `YOOKASSA_SECRET_KEY` + `YOOKASSA_RETURN_URL` and Phase 3 monetization unlocks.

### 🟡 4. Wave 2 work not yet done
Tasks deferred to next session:
- Privacy policy + ToS stub pages linked from Subscription modal
- Referral link UI ("Пригласи друга → +3 дня Premium")
- `/admin/stats` endpoint for self-analytics (signups, plans, completions, conversions)
- Better `/start` and bot menu polish
- Submission package for Telegram-Mini-App catalogs (appss.pro, MiniTelegram)

### 🟡 5. Backend uses `prisma db push`, not migrations
On every deploy, `npx prisma db push --skip-generate --accept-data-loss` runs. For Phase-1/2 this is fine — schema changes are still rapid. Before public launch with paying users, generate proper migrations: `prisma migrate dev --name baseline` once, switch CMD to `prisma migrate deploy`.

## Known Timeweb quirks (operational lessons)

1. **Env var changes don't auto-redeploy**. After editing env in the panel, click **Развернуть заново** or push a no-op commit.
2. **`HEALTHCHECK` directives in our Dockerfiles fight Timeweb's injected healthcheck** → deploys stuck in `starting`. We removed ours from all three Dockerfiles. Don't add them back.
3. **`tsc -b && vite build` may OOM** on the 1 GB tier (we hit silent OOM at least twice on web). Web build script is now `vite build` only.
4. **Parallel deploys race** when you push 2-3 commits in 10 minutes. Each push triggers all 3 Apps. If something gets stuck, **Stop → Start** on the affected App usually fixes it.
5. **Ports 80/443 are reserved** by Timeweb's reverse proxy. Web's nginx listens on `8080`. Don't change this.
6. **CORS** — backend uses `origin: true, credentials: false` with explicit `methods` and `allowedHeaders`. `credentials: true` broke fetch from the Telegram WebView.
7. **Image pull can take 5-15 minutes** between `Build succeeded` and `Container started`. Don't panic before 15 min.

## How to drive Timeweb from a new Claude session

The Timeweb MCP server is now configured in `~/.claude.json`:
```jsonc
{
  "mcpServers": {
    "timeweb": {
      "command": "npx",
      "args": ["-y", "timeweb-mcp-server"],
      "env": { "TIMEWEB_TOKEN": "<JWT from Timeweb panel API page>" }
    }
  }
}
```

After full restart of Claude Code, available tools should include `list_projects`, `list_deployments`, `get_deployment_build_logs`, `get_runtime_logs`, etc. — directly callable without screenshots or downloaded log files.

## Commit history (recent first)

```
9e508fd fix(web): drop conflicting Dockerfile HEALTHCHECK
f6ee92a fix(web): drop tsc from build script (OOM fix)
7f26901 diag: log raw ai-service responses + openrouter status codes
e7a6161 fix(cors): explicit CORS config
5592b19 chore: trigger clean redeploy of all apps
129b486 feat(goals): materialise tasks on goal creation + hard delete with XP/streak recompute + UI confirm modal
879c3ed fix(today): multi-goal task aggregation + cache-by-title + grouped UI + premium polish
83b42e8 feat(web): add 'Create another goal' button + modal
5475dd8 feat(web): show 'Premium active' state in modal + Premium badge in header
9e3b009 feat(auth): ADMIN_TELEGRAM_IDS grants infinite Premium
fa76a45 feat(auth): TELEGRAM_WEBAPP_BOT_TOKEN falls back to TELEGRAM_BOT_TOKEN
5f9ff72 diag: surface specific initData failure reason on server log + client diag panel
533d1df docs: close Phase 1 — day-1 loop verified end-to-end on Timeweb
e673ab0 feat: OpenAI-compatible AI provider (OpenRouter) + Telegram Stars bot payments + richer /start
```

## How to test the live app

1. Open Telegram → search `@AI_Habit_Tracking_bot` → press `/start`
2. Tap the **«Открыть AI Habit Quest»** button (chat menu button, bottom left near the message input)
3. Telegram WebView loads `https://sample322-ai-habit-quest-0676.twc1.net` with `initData`
4. App auto-authenticates → admin gets infinite Premium → goal selector / Today screen / Progress / Premium tabs

If white screen:
- Hard-close Telegram (swipe from task switcher)
- Long-press bot avatar → Clear cache
- Reopen

If "Failed to fetch":
- Backend CORS: already fixed, but if it ever resurfaces, check `backend/src/main.ts` line ~10

## Project planning artifacts

All in `.planning/`:
- `PROJECT.md` — original vision, what we are building and why
- `REQUIREMENTS.md` — 40 REQ-IDs grouped by category
- `ROADMAP.md` — 4 phases (Phase 1 ✅ closed, Phase 2 mostly shipped, Phase 3 & 4 pending)
- `STATE.md` — current phase + open follow-ups
- `DEPLOY-TIMEWEB.md` — full step-by-step Timeweb deploy guide (still accurate, but note ahq-web/ai recreations changed domains)
- `research/SUMMARY.md` — stack/features/architecture/pitfalls research from project init
- `config.json` — GSD workflow config
- `HANDOFF.md` — this file

## Suggested next steps for the new session

In rough priority:

1. **Use the Timeweb MCP to fetch live runtime logs from `ahq-backend` and `ahq-ai`**, then create a new goal in the Mini App to force a `/generate-plan` call. The new diagnostic logging (commit `7f26901`) will reveal why plans are stub. Fix it.

2. **Verify everything else is healthy** through the MCP — check there are no failed deploys queued, all three Apps `Active`, env vars match the table above.

3. **Resume Wave 2:**
   - Privacy policy + ToS templates for RU/CIS
   - Referral link UI + small share-card screen
   - `/admin/stats` endpoint and a minimal admin dashboard page
   - Polish `/start` flow with better illustrations / CTA

4. **Generate a proper Prisma baseline migration** and switch CMD from `db push` to `migrate deploy`.

5. **Prepare the catalog submission** (appss.pro + MiniTelegram): pick screenshots, write a one-paragraph product description, define the bot landing page.

---

*Last updated: 2026-05-30 evening of session 4. Owner: Иван (Telegram `888007035`). Repository: `Sample322/ai-habit-quest`.*
