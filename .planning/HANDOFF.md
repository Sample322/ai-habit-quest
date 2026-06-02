# AI Habit Quest — Session Handoff

> **Read this first** when picking up the project. Current state, live URLs, what works, what's broken, what to do next.

*Last updated: 2026-06-01 (session 8). Owner: Иван (Telegram `888007035`). Repo: `Sample322/ai-habit-quest@master`. HEAD `4c00235`.*

---

## Current status — one paragraph

Telegram Mini App **AI Habit Quest** is **live on Timeweb Cloud**: three Apps (backend NestJS, web React+Vite, ai-service Python FastAPI) + Managed PostgreSQL, auto-deployed from GitHub. **Full day-1 loop works end-to-end:** Telegram `initData` auth → goal creation → real AI plan (OpenRouter/Llama) → daily tasks with streak/XP → goal delete with cascade. Shipped since launch: real AI plans (stub bug fixed), Prisma migrations, secret rotation, rate-limiting, in-app admin, referral program, Privacy/ToS, ranks + achievements + leaderboard, Premium gating, and Premium AI micro-tasks. **One real blocker remains: the Telegram bot can't reliably reach `api.telegram.org` from the RU host** (Telegram blocked in RU) — long-polling eventually connects but flaps ~10 min after each backend restart, and webhook is unreachable. This blocks Stars payments + bot reminders, not the Mini App itself (Mini App loads via user's own VPN).

---

## Live infrastructure

| App | id | Domain | Notes |
|---|---|---|---|
| `ahq-backend` | `200081` | `https://sample322-ai-habit-quest-55ff.twc1.net` | NestJS, Prisma, grammy bot (long-polling), port 3001 |
| `ahq-ai` | `201299` | `https://sample322-ai-habit-quest-71a2.twc1.net` | FastAPI port 8000, OpenAI-compatible client |
| `ahq-web` | `201439` | `https://sample322-ai-habit-quest-0676.twc1.net` | Vite SPA via nginx, `index.html` served `no-cache` |
| Managed PostgreSQL | — | `188.225.27.176:5432` db `default_db` | TLS required (`sslmode=require`) |

- Bot: `@AI_Habit_Tracking_bot` (token `8638703231:AAFw0lqwXz1hqISinKDmzWFCRXbTc8SUwIc`)
- Admin Telegram ID: `888007035` (infinite Premium + in-app admin access)
- OpenRouter: **paid** account (`is_free_tier:false`, ~$5 of $20 left), model `meta-llama/llama-3.1-8b-instruct`
- Owner legal (in Privacy/ToS): Галкин Иван Александрович, самозанятый, ИНН `526223011902`, `ivan.galkin13@gmail.com`

---

## Driving Timeweb

**Use the `tw` CLI helper** — `node ~/.claude/scripts/tw.mjs <cmd>`. Wraps the REST API; pulls token from `~/.claude.json` → `mcpServers.timeweb.env.TIMEWEB_TOKEN` (or `$TIMEWEB_TOKEN`).

Common commands:
- `tw apps` — list 3 apps with status + domain
- `tw info backend` — full app info incl. envs + start_time + ip (name-prefix match works: `backend|ai|web`)
- `tw logs backend [N]` — runtime logs (default 200 lines, ANSI stripped)
- `tw tail backend` — stream new log lines (polls every 4s)
- `tw deploys backend [N]` — deploy history
- `tw dlogs backend [deployId]` — deploy logs (defaults to newest)
- `tw deploy backend [sha]` — trigger deploy (sha defaults to `git rev-parse HEAD`)
- `tw wait-deploy backend [timeoutSec]` — block until success/failure/stopped (exit 3 on fail, 4 on timeout)
- `tw envs backend [--show]` — list env vars (secret-named keys redacted by default)
- `tw set-env backend KEY=VAL ...` — patch envs (merge, preserves existing)
- `tw rm-env backend KEY ...` — drop keys

Flag `--json` for machine-readable output where applicable.

The `timeweb` MCP server itself is now working but only exposes VCS-provider + create-app + presets tools — useless for ops. Use `tw` for everything operational.

Raw REST endpoints behind the wrapper (for reference):
- list apps: `GET /api/v1/apps`
- app info + envs: `GET /api/v1/apps/{id}`
- runtime logs: `GET /api/v1/apps/{id}/logs?limit=N` → `{app_logs:[...]}`
- deploy list: `GET /api/v1/apps/{id}/deploys` (newest first; statuses: `building`→`prepare`→`image_pulled`→`container_started`→`success`/`failure`/`stopped`)
- deploy logs: `GET /api/v1/apps/{id}/deploy/{deployId}/logs` → `{deploy_logs:[...]}`
- trigger deploy: `POST /api/v1/apps/{id}/deploy` body `{"commit_sha":"<40-hex>"}`
- patch envs: `PATCH /api/v1/apps/{id}` body `{"envs":{...}}` (merge model; restart NOT triggered automatically — trigger a deploy to apply)
- ❌ restart: no exposed REST endpoint — trigger a deploy or use the panel

**Deploy auth/verify trick:** can't test authed endpoints via Telegram from a script, so mint an HS256 JWT with the live `JWT_SECRET` and `sub=<userId>`:
```js
const c=require('crypto');const b=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const n=Math.floor(Date.now()/1000);
const d=b({alg:'HS256',typ:'JWT'})+'.'+b({sub:USER_ID,iat:n,exp:n+604800});
const jwt=d+'.'+c.createHmac('sha256',JWT_SECRET).update(d).digest('base64url');
```
Admin user id: `cmppnbehu000111u029hid5l0`. JWT_SECRET (rotated): `59c399a78b1751f1bb67a994fcc6aa497be02f8dcbd700c9dfba90c875169f8f`.

### Deploy gotchas (operational lessons)
1. **Any push redeploys ALL 3 apps** (Timeweb has no path filter). A web-only change still restarts the backend → bot flaps ~10 min. To avoid: disable auto-deploy on `ahq-backend` in panel, deploy it manually.
2. **Parallel/rapid deploys race** → one gets `stopped`/`failure`. Trigger ONE clean deploy and wait. The metadata `commit_sha` can show a commit while the last *successful* deploy is older — always check `deploys[0].status==success`.
3. **Slim runtime image** (`npm prune --omit=dev` in backend Dockerfile) — keep it; full node_modules made the registry pull blow the deploy window.
4. **No HEALTHCHECK in Dockerfiles** — fights Timeweb's injected one. Don't add.
5. **Ports 80/443 reserved**; web nginx listens 8080. Don't change.
6. **`bun`/`tsc` OOM** on 1GB tier — web build is `vite build` only.
7. After deploy, container cutover lags; verify on the deploy that reaches `success`, not the first poll tick.

---

## Env vars (current, live)

**`ahq-backend`** (⚠ = required to boot):
- ⚠ `DATABASE_URL` `postgresql://gen_user:ankavanya1303-@188.225.27.176:5432/default_db?schema=public&sslmode=require`
- ⚠ `JWT_SECRET` (rotated, see above) · ⚠ `TELEGRAM_WEBAPP_BOT_TOKEN` (=bot token) · ⚠ `ADMIN_BASIC_PASSWORD` `mmELlIAkKgexpDYHeI2daQGB`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME=AI_Habit_Tracking_bot`
- `AI_SERVICE_URL=https://sample322-ai-habit-quest-71a2.twc1.net`
- `ADMIN_TELEGRAM_IDS=888007035`, `NODE_ENV=production`, `TZ=Europe/Moscow`, `BACKEND_PORT=3001`, `ADMIN_BASIC_USER=admin`
- `FREE_MAX_GOALS=1`, `FREE_MAX_HABITS=3`, `FREE_PLAN_HORIZON_DAYS=7`
- `TELEGRAM_WEBHOOK_URL` — **must stay UNSET** (webhook unreachable on RU host; unset = long-polling)
- Stale/unused: `AI_PROVIDER=stub` (backend ignores it — harmless, can delete)

**`ahq-ai`**:
- `AI_PROVIDER=openai`, `OPENAI_API_KEY=sk-or-v1-...`, `OPENAI_MODEL=meta-llama/llama-3.1-8b-instruct`
- `OPENAI_BASE_URL=https://openrouter.ai/api/v1`, `OPENAI_APP_NAME`, `OPENAI_APP_URL`, `TZ`
- optional tuning: `OPENROUTER_IGNORE_PROVIDERS` (default `wandb`), `OPENAI_MAX_ATTEMPTS` (default 5), `OPENAI_RETRY_DELAY` (1.0)

**`ahq-web`** (build-time, baked by Vite):
- `VITE_API_BASE_URL=https://sample322-ai-habit-quest-55ff.twc1.net`
- `VITE_TG_BOT_USERNAME=AI_Habit_Tracking_bot`

---

## What works end-to-end (verified)

- Telegram `initData` HMAC auth → JWT sessions, `/me` (returns `isAdmin`, `referralCode`, `referralCount`)
- Goal creation (4 categories) → **real AI plan** (OpenRouter/Llama), habits + daily tasks materialised for all active goals
- Mark task done → XP/streak/level recompute; goal delete with cascade + recompute + confirm modal
- **`/ai/diag`** — backend→ai-service probe (provider + latency); use to confirm AI health
- **Plan regeneration** `POST /goals/:id/regenerate-plan` — Premium-only; generate-first, only replace if non-stub
- **In-app admin** (🛠 header button, admin only): `/app-admin/stats|users|users/:id/premium|feedback`. Also Basic-auth `/admin/*` + `/admin/dashboard` HTML.
- **Referral**: `t.me/AI_Habit_Tracking_bot?startapp=ref_<code>`; inviter +3d Premium on invitee's FIRST signup (self-invite blocked, cap 10/mo). Card on Today (share/copy).
- **Gamification**: ranks (Новичок→Легенда) w/ XP-to-next, 11 derived achievements (+unlock toast on toggle), live leaderboard (top 20 + my rank) — all on revamped Progress screen.
- **Premium AI micro-task** (`/bonus/today`, `/bonus/:id/complete`): 1 daily AI stretch action, +25 XP, expires end of day, lazy-generated on Today open (no bot dependency). Premium-only.
- Privacy/ToS pages live (`/privacy.html`, `/terms.html`, RU+EN, real legal data), linked from Premium screen.
- Web: RU/EN i18n, dark theme, staged goal-creation progress screen, no-cache index.

---

## What's broken / pending — by urgency

### 🟡 1. Bot ↔ Telegram connectivity — Cloudflare Worker proxy ready, awaits CF deploy
Backend code now supports webhook mode through a Cloudflare Worker proxy that handles both directions (RU backend → CF Worker → `api.telegram.org`, and Telegram → CF Worker → RU backend `/bot/webhook`). All code merged on `master`; activation needs three things done by the owner once:
1. Deploy the Worker: `cd infra/cloudflare-worker && npm install && npx wrangler login && npx wrangler secret put BACKEND_BASE && npx wrangler secret put WEBHOOK_SECRET && npm run deploy`
2. Set the three env vars on `ahq-backend`: `TELEGRAM_API_ROOT=$WORKER_URL`, `TELEGRAM_WEBHOOK_URL=$WORKER_URL/webhook`, `TELEGRAM_WEBHOOK_SECRET=<same secret>` (use `tw set-env backend KEY=VAL ...`).
3. Redeploy backend; on boot it calls `setWebhook` via the Worker and flips into webhook mode. Verify with `curl …/bot/status` → `{"mode":"webhook"}`.

Full step-by-step in `infra/cloudflare-worker/README.md`. Until the Worker is up, backend stays on long-polling (existing behavior — no regression). Long-polling fallback is automatic if `TELEGRAM_WEBHOOK_URL` is unset or `setWebhook` fails.

### 🟡 2. Telegram Stars — code ready, not activated
`bot.service.ts` handles `pre_checkout_query` + `:successful_payment` → `payments.handleStarsSuccessFromBot` (idempotent). Blocked by #1. Activate after bot is reliable.

### 🟡 3. YooKassa — stubbed
`yookassa.provider.ts` returns mock URLs without creds. Owner is now самозанятый → can get a YooKassa shop. Plug `YOOKASSA_SHOP_ID`/`YOOKASSA_SECRET_KEY`/`YOOKASSA_RETURN_URL`, implement real `/v3/payments` call (currently throws "not yet implemented").

### 🟡 4. Catalog submission — guide ready, needs assets
`.planning/CATALOG-SUBMISSION.md` has texts/checklist. Owner action: icon 512×512 + 3-5 screenshots; enable Main Mini App in BotFather (URL = web domain) so `?startapp=` links open.

### 🟡 5. Reminders cron — exists, untested + bot-dependent
Delivery via bot → blocked by #1.

---

## Next-session ideas (designed, not built)

See `.planning/IDEAS-NEXT.md` for full design. Highlights:
- Achievement rarity/secret badges; Premium-only achievements + avatar frames/titles.
- Per-goal progress: 30-day heatmap, "day X of horizon", weekly recap.
- **Streak-freeze** (Premium, needs migration).
- **Leagues** (Duolingo-style weekly groups) — strongest retention.
- Referral anti-abuse: reward inviter only after invitee's first completed task (needs `User.referralRewarded`, migration).

---

## DB / migrations

Prod DB is on **Prisma Migrate** now (baseline `0_init` resolved-as-applied; Dockerfile CMD = `prisma migrate deploy && node dist/main.js`). **No more `db push --accept-data-loss`.** To add schema: edit `schema.prisma`, generate migration via `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <db>?schema=ahq_shadow --script > prisma/migrations/<name>/migration.sql`, commit, deploy. Latest migration: `20260601_add_bonus_task`. `migration_lock.toml` present (`postgresql`).

## How to test live

1. Telegram → `@AI_Habit_Tracking_bot` → `/start` → tap menu button → Mini App loads `…0676…` with `initData`.
2. Admin auto-Premium; create goal → staged progress → real plan. Today/Progress/Premium tabs + 🛠 admin.
3. On PC (Telegram Desktop): ⋮ → **Reload Page** to pull fresh bundle (index is no-cache).
4. White screen / Failed to fetch right after a backend deploy = container restarting; wait ~1-2 min.

## Planning artifacts (`.planning/`)
`PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `DEPLOY-TIMEWEB.md`, `CATALOG-SUBMISSION.md`, `IDEAS-NEXT.md`, `research/SUMMARY.md`, `HANDOFF.md` (this file). Local helper: `C:\Users\Галкин Иван\uat.mjs` (mints JWT, runs core UAT against prod).

## Recent commits (newest first)
```
4c00235 feat(web): AI bonus card on Today + achievement-unlock toast
dd8ce97 feat(bonus): Premium AI micro-task (BonusTask model+migration, lazy gen, +XP) + achievement detection in toggle
ca6f35f feat(ai-service): /bonus-task endpoint — daily AI stretch action
9ba594c feat(web): Progress revamp UI — rank card, achievements grid, leaderboard
ae4ee07 feat(gamification): ranks, derived achievements, live leaderboard; gate regenerate to Premium
6df4aa4 fix(links): Main Mini App deep link (t.me/bot?startapp=) for referral + start
463171a fix(web): pass onAdminClick to main-view Header so admin gear shows
3f98809 feat(web): referral card on Today
689760d feat(referral): reward inviter +3d Premium on signup; fix referredById
10c5c7e feat(web): in-app Admin screen + fix Progress chart bars
c49b610 feat(admin): in-app admin API via JWT + admin Telegram ID
9016324/f186531 docs(legal): Privacy/ToS operator data
(earlier: Prisma migrations baseline, rate-limiting+webhook, secret rotation, OpenRouter retries/provider.ignore, slim Docker image, /ai/diag, regenerate-plan)
```
