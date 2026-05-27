# Production deployment — Timeweb Cloud

This guide takes the repo from your machine to a live Telegram Mini App with GitHub-driven auto-deploy, in roughly **45–60 minutes** of clicks. Cost for the MVP layout: **~1300 ₽/month** (3 Apps × ~280 ₽ + 1 Managed PostgreSQL × ~450 ₽).

## Architecture on Timeweb

```
                            ┌─────────────────────────────────┐
                            │  Timeweb Cloud Apps             │
   GitHub repo  ───push───▶ │  (auto-deploy on commit)        │
   main branch              │                                 │
                            │  ┌──────────────┐               │
                            │  │ ahq-web      │ ── HTTPS ──▶  │ Telegram Mini App URL
                            │  │ (nginx:8080) │   *.twc1.net  │ (you paste this in
                            │  └──────┬───────┘               │  @BotFather)
                            │         │ /api/* fetch          │
                            │  ┌──────▼───────┐               │
                            │  │ ahq-backend  │               │
                            │  │ (NestJS:3001)│               │
                            │  └──────┬───────┘               │
                            │         │                       │
                            │  ┌──────▼───────┐ ───┐          │
                            │  │ ahq-ai       │    │  AI port │
                            │  │ (FastAPI:8000)│   │  stub|ollama
                            │  └──────────────┘   │          │
                            └─────────────────────┼──────────┘
                                                  ▼
                              ┌──────────────────────────────────┐
                              │  Timeweb Managed PostgreSQL 16   │
                              │  (Cloud DB 1/2/20, ~450 ₽/mo)    │
                              └──────────────────────────────────┘

                              (optional, Phase 2 / when DAU pays for it)
                              ┌──────────────────────────────────┐
                              │  GPU VPS (RTX A4000 / 3090)      │
                              │  Ollama + qwen3:4b / gemma3:4b   │
                              │  Backend AI_PROVIDER=ollama      │
                              │  OLLAMA_BASE_URL=http://<ip>:11434│
                              └──────────────────────────────────┘
```

Three things Timeweb Cloud Apps **can't** do (so we work around them):
1. **Volumes are forbidden** — Postgres data has to live in Managed DBaaS, not in an in-App container.
2. **Ports 80 and 443 reserved** by the platform's reverse proxy — our nginx listens on 8080 and Timeweb proxies it.
3. **No GPU on Apps** — Ollama with a real model goes on a separate Cloud Server, not on Apps. For MVP we ship the **stub provider** and flip the switch later.

## What you'll get when this is done

- `https://ahq-web-XXXXXX.twc1.net` — your live Mini App. Paste this URL in @BotFather.
- `https://ahq-backend-XXXXXX.twc1.net/health` — backend health probe.
- `https://ahq-ai-XXXXXX.twc1.net/healthz` — AI service health probe.
- Push to `main` → all three Apps rebuild automatically.

---

# Step-by-step

## 1. Push the repo to GitHub (5 min)

On your machine:

```powershell
cd C:\ai-habit-quest

# Create the repo on github.com first (private), then:
git remote add origin https://github.com/<your-handle>/ai-habit-quest.git
git branch -M main
git push -u origin main
```

> The `.gitignore` already excludes `.env`, so your bot token is **not** pushed.

## 2. Create a Timeweb Cloud account (2 min)

1. Sign up at https://timeweb.cloud (Russian phone + email).
2. Top up the balance — **5 000 ₽** covers everything below for a month.
3. In the panel, create a new **Project** called `ai-habit-quest`. Every Timeweb resource we make goes inside it for grouped billing.

## 3. Create the Managed PostgreSQL (5 min)

1. Left sidebar → **Базы данных (Databases)** → **Создать** (Create).
2. Engine: **PostgreSQL 16**.
3. Tariff: **Cloud DB 1/2/20** (1 vCPU, 2 GB RAM, 20 GB SSD — `~450 ₽/mo`). Enough for tens of thousands of users at MVP scale.
4. Region: **Москва (Moscow)**.
5. Public network: **on** (we need the Apps to reach it; later we'll lock it to Timeweb's private network).
6. Name: `ahq-postgres`.
7. After it provisions (~2 min), open it and copy:
   - **Host** (something like `xxxxxx.timeweb.cloud`)
   - **Port** (usually `5432`)
   - **User** (e.g. `gen_user`)
   - **Password**
   - **Database name** (e.g. `default_db`)
8. Build the **DATABASE_URL** string — you'll paste this into the backend App's env vars in step 5:
   ```
   postgresql://<user>:<password>@<host>:<port>/<dbname>?schema=public&sslmode=require
   ```

> Timeweb's Managed PG requires SSL. The `?sslmode=require` is important — Prisma will pick it up.

## 4. Authorize Timeweb to read your GitHub (1 min)

1. Panel → **Apps** → **Создать (Create)** → **Из репозитория (From repository)**.
2. Click **GitHub** → authorize the Timeweb GitHub app for your account → grant access **only** to `ai-habit-quest` (don't give it access to all repos).
3. Cancel out of the "Create App" dialog after authorizing — we'll come back in the next steps.

## 5. Create App #1 — `ahq-backend` (10 min)

1. **Apps → Создать**.
2. **Application type:** **Dockerfile** tab.
3. **Repository:** `<your-handle>/ai-habit-quest`. **Branch:** `main`. **Auto-deploy on commit:** ON.
4. **Project directory:** `backend` ← important, this points Timeweb at `backend/Dockerfile`.
5. **Server config:** smallest tier (1 vCPU / 1 GB RAM / 20 GB), `~282 ₽/mo`. Region: Moscow.
6. **App name:** `ahq-backend`.
7. **Healthcheck path:** `/health`.
8. **Environment variables (Переменные)** — add all of these (click "Добавить переменную" per row):

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `TZ` | `Europe/Moscow` |
   | `BACKEND_PORT` | `3001` |
   | `DATABASE_URL` | the URL you built in step 3 (with `sslmode=require`) |
   | `JWT_SECRET` | run `openssl rand -hex 32` locally and paste the output, or any 64-char random string |
   | `TELEGRAM_BOT_TOKEN` | `8638703231:AAFw0lqwXz1hqISinKDmzWFCRXbTc8SUwIc` |
   | `TELEGRAM_BOT_USERNAME` | `AI_Habit_Tracking_bot` |
   | `TELEGRAM_WEBAPP_BOT_TOKEN` | `8638703231:AAFw0lqwXz1hqISinKDmzWFCRXbTc8SUwIc` |
   | `TELEGRAM_WEBHOOK_URL` | leave empty for now — fill it after the App gets its tech domain (step 8) |
   | `AI_SERVICE_URL` | leave empty for now — fill in step 7 |
   | `YOOKASSA_SHOP_ID` | leave empty (provider runs in mock mode until you fill it) |
   | `YOOKASSA_SECRET_KEY` | leave empty |
   | `YOOKASSA_RETURN_URL` | leave empty for now |
   | `TELEGRAM_STARS_ENABLED` | `false` for now (turn on after first user buys Premium via Stars works in BotFather test) |
   | `ADMIN_BASIC_USER` | `admin` |
   | `ADMIN_BASIC_PASSWORD` | any strong password (you'll use this to open `/admin/users` from a browser) |
   | `FREE_MAX_GOALS` | `1` |
   | `FREE_MAX_HABITS` | `3` |
   | `FREE_PLAN_HORIZON_DAYS` | `7` |
   | `PUBLIC_API_URL` | leave empty for now — fill in step 6 |

9. Click **Create**. The first build takes ~5 min (`npm install`, `nest build`, `prisma generate`). Watch the build log inside the App.
10. When the build is green, the App detail page shows a tech domain like `ahq-backend-7c3a.twc1.net`. **Copy this domain** — call it `BACKEND_DOMAIN`.
11. Check it works: open `https://<BACKEND_DOMAIN>/health` in a browser. You should see `{"status":"ok","db":"up","ts":"..."}`. If db is `"down"`, the DATABASE_URL is wrong — fix the var and trigger a redeploy.

## 6. Create App #2 — `ahq-ai` (the AI service) (5 min)

1. **Apps → Создать**.
2. Type: **Dockerfile**. Repo: same. Branch: `main`. Auto-deploy: ON.
3. **Project directory:** `ai-service`.
4. **Server config:** smallest tier (1 vCPU / 1 GB RAM), ~282 ₽/mo.
5. **App name:** `ahq-ai`.
6. **Healthcheck path:** `/healthz`.
7. **Environment variables:**

   | Key | Value |
   |---|---|
   | `AI_PROVIDER` | `stub` |
   | `OLLAMA_BASE_URL` | leave empty for now |
   | `OLLAMA_MODEL` | `qwen3:4b` |
   | `TZ` | `Europe/Moscow` |

8. Create. After build: copy the domain (`ahq-ai-XXXX.twc1.net`) — call it `AI_DOMAIN`.
9. Test: `https://<AI_DOMAIN>/healthz` returns `{"status":"ok","provider":"stub"}`.

## 7. Wire backend to AI service

1. Go back to **ahq-backend** App → **Variables (Переменные)**.
2. Set `AI_SERVICE_URL` = `https://<AI_DOMAIN>` (no trailing slash).
3. Save → backend redeploys (~2 min). After redeploy, hitting any endpoint that generates a plan will fan out to the AI service.

## 8. Create App #3 — `ahq-web` (the Mini App) (5 min)

1. **Apps → Создать**.
2. Type: **Dockerfile**. Repo: same. Branch: `main`. Auto-deploy: ON.
3. **Project directory:** `web`.
4. **Server config:** smallest tier (1 vCPU / 1 GB RAM), ~282 ₽/mo.
5. **App name:** `ahq-web`.
6. **Healthcheck path:** `/` (nginx serves `index.html`).
7. **Environment variables — these are Vite build args, baked into the JS at build time:**

   | Key | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://<BACKEND_DOMAIN>` (no trailing slash) |
   | `VITE_TG_BOT_USERNAME` | `AI_Habit_Tracking_bot` |

   > These are read in the Dockerfile via `ARG VITE_API_BASE_URL` and embedded into the static bundle. If you change them later, click **Redeploy**.

8. Create. After build, copy the web tech domain — call it `WEB_DOMAIN`. Open it in a browser: you'll see the loader and an error "Open this app from Telegram" (because there's no Telegram WebApp on a plain browser). That's normal.

## 9. Tell the backend its public URL

1. **ahq-backend → Variables** → set `PUBLIC_API_URL` = `https://<BACKEND_DOMAIN>`. Save → redeploy.
2. Also set `YOOKASSA_RETURN_URL` = `https://<WEB_DOMAIN>` so YooKassa knows where to send the user back after payment. Save → redeploy.

## 10. Register the Mini App in @BotFather (3 min)

1. Open https://t.me/BotFather → `/mybots` → `@AI_Habit_Tracking_bot`.
2. **Bot Settings → Menu Button → Configure menu button** →
   - Text: `Открыть AI Habit Quest`
   - URL: `https://<WEB_DOMAIN>`
3. Optional but recommended: **Bot Settings → Configure Mini App → Enable** → set the same URL.
4. Optional: set the bot's title, description, and About via `/setname`, `/setdescription`, `/setabouttext`.

## 11. Turn the Telegram bot webhook on (optional, but cheaper than long-polling)

1. In **ahq-backend → Variables**, set `TELEGRAM_WEBHOOK_URL` = `https://<BACKEND_DOMAIN>/telegram/webhook`.
2. > _The current backend boots `grammy` in long-polling mode if `TELEGRAM_WEBHOOK_URL` is empty. For Phase 4 we'll wire a real `POST /telegram/webhook` controller — until then, leave this empty and the bot will work via long-polling. That's fine for MVP._

## 12. First end-to-end test (5 min)

1. Open Telegram → find `@AI_Habit_Tracking_bot` → send `/start`. The bot replies with the "Open" button.
2. Tap the button → Mini App opens. The web app calls `POST /auth/telegram` on the backend with your real `initData`, the backend verifies the HMAC against `TELEGRAM_BOT_TOKEN`, creates a user row, returns a JWT.
3. You see the onboarding screen → pick a category → enter a title → tap "Поехали".
4. Goal is saved, plan generated (stub provider), three habits attached. The Today screen shows today's three tasks.
5. Tap a task → it ticks, you see +10 XP, streak goes from 0 → 1.
6. Open the Progress tab → streak / level / XP / last-7-days bar should render.
7. Open the Premium tab → see the trial offer + Stars button. (YooKassa returns a mock URL because we left the keys empty — that's expected.)

## 13. Verify auto-deploy

1. On your machine, edit something visible (e.g. change the headline in `web/src/lib/i18n.ts` or update the goal title in `backend/src/ai/stub-plans.ts`).
2. ```powershell
   git add -A
   git commit -m "tweak: copy"
   git push
   ```
3. Within ~30 sec the relevant App in Timeweb starts a new build. Watch the build log. After ~2–4 min you'll see your change live.

---

# Ollama on Timeweb — when and how

Apps don't support GPU. To run **real** Qwen3-4B / Gemma 3-4B on Timeweb you need a separate **Cloud Server with GPU**. Plan it like this:

## Option A — MVP launch (recommended): keep `AI_PROVIDER=stub`

The stub provider returns deterministic, hand-tuned per-category plans (`backend/src/ai/stub-plans.ts` and `ai-service/stub_plans.py`). They're good enough to validate the loop, ship to beta users, and measure retention without paying for a GPU.

## Option B — Self-host Ollama on a Timeweb GPU VPS

When you're ready (paying users justify the spend):

1. **Apps → "Серверы с GPU"** in the Timeweb panel. Pricing is by request — for a 4B-parameter Q4 model you want **min 8 GB VRAM**. Cheapest fit: RTX A4000 (16 GB) or RTX 3090 (24 GB). Expect ~**15–25k ₽/mo** for that tier (Timeweb requires a 5 000 ₽ advance and a sales call to confirm).
2. Order Ubuntu 22.04. SSH in.
3. Install Ollama:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ollama pull qwen3:4b           # ~2.5 GB
   # or:  ollama pull gemma3:4b
   ```
4. By default Ollama binds to `127.0.0.1:11434`. Open it to the Timeweb private network only:
   ```bash
   sudo systemctl edit ollama.service
   # add:
   # [Service]
   # Environment="OLLAMA_HOST=0.0.0.0:11434"
   sudo systemctl restart ollama
   ```
5. **Firewall:** restrict port 11434 to Timeweb's private network or to the Apps' public IPs only — never expose it to the open internet.
6. In **ahq-ai → Variables**:
   - `AI_PROVIDER` = `ollama`
   - `OLLAMA_BASE_URL` = `http://<gpu-vps-private-ip>:11434`
   - `OLLAMA_MODEL` = `qwen3:4b`
   Save → redeploy. The FastAPI service will start calling Ollama; if Ollama is down it falls back to the stub. Zero code changes.

## Option C — Off-host Ollama (cheapest)

If GPU rentals at Timeweb are too rich for the stage you're at, point `OLLAMA_BASE_URL` at any external Ollama-compatible endpoint:
- Your own home machine + Cloudflare Tunnel.
- A Vast.ai or Runpod pod (per-hour, you spin it up when you need to regenerate plans, off otherwise).
- Together AI / OpenRouter / DeepInfra with an OpenAI-compatible wrapper (would require a small adapter in `ai-service/main.py` — not done yet).

---

# Cost summary at MVP

| Item | Spec | Monthly |
|---|---|---|
| Apps × 3 (web, backend, ai) | 1 vCPU / 1 GB each | ~840 ₽ |
| Managed PostgreSQL | Cloud DB 1/2/20 | ~450 ₽ |
| **Total** | | **~1 290 ₽** |
| (optional later) GPU VPS for Ollama | RTX A4000-ish | ~15–25 k ₽ |

---

# Troubleshooting cheatsheet

**Backend build fails on `prisma generate`** — the Prisma engines binary needs OpenSSL 3 in Alpine. Already covered by the `node:20-alpine` base. If it ever breaks: bump to `node:20-slim`.

**`db: "down"` in `/health`** — `DATABASE_URL` is wrong, or you forgot `?sslmode=require` for Timeweb Managed PG.

**Mini App in Telegram shows "Open this app from Telegram"** — you opened the WEB_DOMAIN directly in a browser instead of through the bot. Normal. Open it via `t.me/AI_Habit_Tracking_bot` → menu button.

**`401 Unauthorized` from `/auth/telegram`** — the bot token in `TELEGRAM_WEBAPP_BOT_TOKEN` doesn't match the bot you opened the Mini App from. They MUST be the same token.

**Web shows `Mixed Content` errors in the browser console** — `VITE_API_BASE_URL` was set to `http://` instead of `https://`. Fix the var and redeploy the `ahq-web` App.

**Apps stuck "building"** — Timeweb build queues sometimes pause overnight. Manual **Redeploy** button in the App detail unsticks it.

**Pushed to GitHub but no auto-deploy** — check that the App's Settings → "Auto-deploy on commit" is ON and that the branch matches what you pushed to (`main`). If still nothing, the GitHub OAuth app may have lost permissions — re-authorize from Apps → Создать → GitHub.

**Want a custom domain (e.g. `app.habit-quest.ru`)** — point an `A` record to the App's IP shown in the App detail. Timeweb auto-provisions a Let's Encrypt cert when the DNS resolves. Update `VITE_API_BASE_URL` and `YOOKASSA_RETURN_URL` accordingly, then redeploy.
