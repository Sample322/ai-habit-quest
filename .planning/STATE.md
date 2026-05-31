# State — AI Habit Quest

**Initialized:** 2026-05-27
**Phase 1 closed:** 2026-05-29
**Current focus:** Launch-readiness & security (Prisma migrations ✅, secret rotation, webhook)
**Status:** all three Apps live on Timeweb; AI plans real & relevant (OpenRouter via ai-service, retries beat geo/429); day-1 loop + regenerate verified end-to-end; DB now on Prisma migrations

> **For a complete picture, see [HANDOFF.md](HANDOFF.md)** — it has live URLs, env vars, open issues, next steps, and instructions to drive Timeweb via MCP.

## Phase progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Foundation & day-1 loop | ✅ **done** (2026-05-29) | All success criteria met. End-to-end verified in Telegram. |
| 2 — Tasks, gamification, reminders, i18n | ✅ shipped, partial verification | Multi-goal aggregation + cache + goal delete fixed. Reminders cron live but not yet UAT'd. |
| Wave 1 (real AI + Stars hooks) | ✅ **done** (2026-05-31) | AI stub bug resolved (URL + WandB ignore + 403/429 retries). `/ai/diag` 10/10 openai. Per-goal regenerate-plan added. |
| Launch-readiness | ⏳ in flight | Prisma migrations adopted (baseline 0_init, `migrate deploy` on boot) ✅. TODO: rotate JWT_SECRET/ADMIN_PASSWORD + NODE_ENV=production (owner, panel); optional bot webhook. |
| Wave 2 (privacy + referrals + admin stats) | pending | After launch-readiness. |
| 3 — Monetisation & admin | partial | Telegram Stars code ready (flag off). YooKassa stubbed until self-employed registration. |
| 4 — Growth & launch checklist | pending | Catalogs, referrals, polish. |

## Live URLs

- web: https://sample322-ai-habit-quest-0676.twc1.net
- backend: https://sample322-ai-habit-quest-55ff.twc1.net
- ai-service: https://sample322-ai-habit-quest-71a2.twc1.net

## Recent commits

```
9e508fd fix(web): drop conflicting Dockerfile HEALTHCHECK
f6ee92a fix(web): drop tsc from build script (OOM fix)
7f26901 diag: log raw ai-service responses + openrouter status codes
e7a6161 fix(cors): explicit CORS config
129b486 feat(goals): materialise tasks on goal creation + hard delete with XP/streak recompute + UI confirm modal
```

## Open follow-ups (top of stack)

1. ✅ **AI plan stub fallback** — RESOLVED (stale AI_SERVICE_URL + WandB geo-block 403 + upstream 429; fixed via env + provider.ignore + retries). Note: Timeweb MCP is non-functional (`spawn npx ENOENT`); drive Timeweb via REST API with `TIMEWEB_TOKEN` instead.
2. ✅ **Prisma baseline migration** — DONE. Baseline `0_init` resolved-as-applied on prod; Dockerfile runs `migrate deploy` on boot (no more `db push --accept-data-loss`).
3. **Rotate secrets (owner, Timeweb panel)** — `JWT_SECRET`, `ADMIN_BASIC_PASSWORD`, set `NODE_ENV=production` on `ahq-backend`, then redeploy.
4. **Switch backend bot from long-polling to webhook** — set `TELEGRAM_WEBHOOK_URL` once we have a stable HTTPS endpoint (avoids 409 getUpdates conflicts on restart).
4. **Wave 2 work** — privacy + ToS pages, referral link UI, `/admin/stats` endpoint.
5. **Telegram Stars** — flip `TELEGRAM_STARS_ENABLED=true`, run an end-to-end Stars test.

## Quick links

- [HANDOFF.md](HANDOFF.md) — full session handoff (read this first)
- [PROJECT.md](PROJECT.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
- [ROADMAP.md](ROADMAP.md)
- [DEPLOY-TIMEWEB.md](DEPLOY-TIMEWEB.md)
- [research/SUMMARY.md](research/SUMMARY.md)
