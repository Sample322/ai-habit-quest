# Telegram Bot Proxy on Cloudflare Workers

This Worker fixes the **"RU host can't reliably reach `api.telegram.org`"** problem by proxying the bot's traffic in both directions.

```
                          ┌─────────────────────────┐
   Telegram ─── POST ───► │  Cloudflare Worker       │ ─── POST /bot/webhook ──► RU backend (Timeweb)
                          │  https://ahq-bot-proxy   │
   RU backend ── GET ───► │  .<your>.workers.dev     │ ─── GET /bot<TOKEN>/... ─► api.telegram.org
                          └─────────────────────────┘
```

The Worker is **stateless**: no KV, no D1, no secrets stored on disk. It only knows two env vars:

| Variable           | Where it is set on the Worker | Used for                                                         |
|--------------------|-------------------------------|------------------------------------------------------------------|
| `BACKEND_BASE`     | wrangler secret               | URL of the RU backend (e.g. `https://sample322-…-55ff.twc1.net`) |
| `WEBHOOK_SECRET`   | wrangler secret               | Random ≥32-char string shared with Telegram + backend            |

---

## What you need to do (one-time, ~15 min)

### Step 0 — accounts

You'll need:
- A **Cloudflare** account (free tier is enough). Sign up at https://dash.cloudflare.com/sign-up if you don't have one.
- Local **Node 20+** so you can run `wrangler` (Cloudflare's CLI).

### Step 1 — generate a webhook secret

```bash
# any 32+ char random string; example using openssl:
openssl rand -hex 32
# → 1f3c8a…  (copy this, paste it into BOTH the Worker AND the backend later)
```

Save it as `$WEBHOOK_SECRET` in your shell for the next steps.

### Step 2 — deploy the Worker

From the repo root:

```bash
cd infra/cloudflare-worker
npm install
npx wrangler login            # opens browser, auth your CF account
npx wrangler secret put BACKEND_BASE
# paste:  https://sample322-ai-habit-quest-55ff.twc1.net
npx wrangler secret put WEBHOOK_SECRET
# paste the secret you generated in Step 1
npm run deploy
```

Wrangler prints the public Worker URL, something like:

```
https://ahq-bot-proxy.<your-cf-username>.workers.dev
```

**Copy that URL** — call it `$WORKER_URL`.

Verify it's alive:

```bash
curl $WORKER_URL/        # → ok
```

### Step 3 — point the backend at the Worker

Set these three env vars on the **`ahq-backend`** app in Timeweb (use either the panel or the `tw` CLI):

```bash
# Using the local tw helper (token already in ~/.claude.json):
node ~/.claude/scripts/tw.mjs set-env backend \
  TELEGRAM_API_ROOT=$WORKER_URL \
  TELEGRAM_WEBHOOK_URL=$WORKER_URL/webhook \
  TELEGRAM_WEBHOOK_SECRET=<paste-the-same-secret>
```

| Backend env var            | Value                                          | Why                                                                 |
|----------------------------|------------------------------------------------|---------------------------------------------------------------------|
| `TELEGRAM_API_ROOT`        | `$WORKER_URL`  (NO trailing slash)             | grammy will call the Worker instead of `api.telegram.org`           |
| `TELEGRAM_WEBHOOK_URL`     | `$WORKER_URL/webhook`                          | tells the backend to register this URL via `setWebhook` on boot     |
| `TELEGRAM_WEBHOOK_SECRET`  | the secret from Step 1                         | both Worker and backend validate `X-Telegram-Bot-Api-Secret-Token`  |

### Step 4 — redeploy the backend so it picks up the envs

```bash
node ~/.claude/scripts/tw.mjs deploy backend
node ~/.claude/scripts/tw.mjs wait-deploy backend
```

On boot the backend will:
1. Initialise grammy with `apiRoot = $WORKER_URL`.
2. Call `setWebhook($WORKER_URL/webhook, secret_token=$WEBHOOK_SECRET)` via the Worker.
3. Switch into webhook mode (no more long-polling).

### Step 5 — verify end-to-end

```bash
# 1) backend status — should show "webhook"
curl https://sample322-ai-habit-quest-55ff.twc1.net/bot/status
# → {"mode":"webhook"}

# 2) Telegram's record of the webhook — should show your Worker URL with no errors
curl https://sample322-ai-habit-quest-55ff.twc1.net/bot/diag-tg   # (not implemented; see logs instead)

# 3) backend logs — look for "Bot in webhook mode → …"
node ~/.claude/scripts/tw.mjs logs backend 200 | grep -i 'bot\|webhook'
```

Then in Telegram: send `/start` to `@AI_Habit_Tracking_bot`. The reply should be instant (no 10-minute long-polling warm-up).

---

## What I, Claude, already did for you

In code:
- `infra/cloudflare-worker/` — full Worker project (TS source, wrangler config, package.json).
- `backend/src/bot/bot.service.ts` — grammy now reads `TELEGRAM_API_ROOT` and `TELEGRAM_WEBHOOK_URL`; falls back to long-polling if either is missing.
- `backend/src/bot/bot.controller.ts` — `POST /bot/webhook` endpoint that re-validates the secret header, then forwards to grammy's `handleUpdate`.
- `backend/src/bot/bot.module.ts` — registers the controller.

The backend already builds + deploys clean (TSC, nest build, vite all green).

---

## Rollback

If something goes wrong, blow the webhook away and the bot returns to long-polling on next deploy:

```bash
# 1) Drop the env var that activates webhook mode:
node ~/.claude/scripts/tw.mjs rm-env backend TELEGRAM_WEBHOOK_URL
# 2) Redeploy:
node ~/.claude/scripts/tw.mjs deploy backend
# 3) (Optional) tell Telegram to forget the webhook too:
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

The outbound proxy (`TELEGRAM_API_ROOT`) is independent — you can keep it on even in long-polling mode; it just makes `getUpdates` go through the Worker.

---

## Cost & limits

- Cloudflare Workers **free tier**: 100k requests/day. The bot will use ≤ a few thousand a day with normal traffic — comfortably free.
- No outbound transfer charges from the Worker itself.
- The backend only sees webhook traffic (one POST per Telegram event), not long-polling's constant `getUpdates` heartbeat — small CPU win.

---

## Troubleshooting

| Symptom                                                       | Likely cause                                            | Fix                                                                            |
|---------------------------------------------------------------|---------------------------------------------------------|--------------------------------------------------------------------------------|
| Backend logs `setWebhook failed: Unauthorized`                | `TELEGRAM_BOT_TOKEN` mismatch                           | Re-check env var; it must be the SAME bot the Worker is proxying for           |
| Telegram says `Wrong response from the webhook: 403 Forbidden`| Secret mismatch (Worker vs backend)                     | Same `WEBHOOK_SECRET` in both                                                  |
| `/bot/status` says `long-polling` after deploy                | `TELEGRAM_WEBHOOK_URL` not set, or backend boot pre-env | Confirm env, redeploy                                                          |
| Worker logs show 502/504 to `BACKEND_BASE`                    | Timeweb container restarting                            | Wait, or check `node tw.mjs deploys backend`                                   |
| `tail` shows `Connection reset` from `api.telegram.org`       | CF region transiently blocked                           | Rare; CF auto-rotates region. Retry the user action.                           |

Logs:
```bash
# Worker logs (live):
cd infra/cloudflare-worker && npm run tail

# Backend logs:
node ~/.claude/scripts/tw.mjs tail backend
```
