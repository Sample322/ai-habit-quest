# State — AI Habit Quest

**Initialized:** 2026-05-27
**Phase 1 closed:** 2026-05-29
**Current focus:** Wave 1 deployment + diagnosis of AI plan fallback
**Status:** all three Apps live on Timeweb, day-1 loop verified, AI provider intermittently falling back to stub (under diagnosis)

> **For a complete picture, see [HANDOFF.md](HANDOFF.md)** — it has live URLs, env vars, open issues, next steps, and instructions to drive Timeweb via MCP.

## Phase progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Foundation & day-1 loop | ✅ **done** (2026-05-29) | All success criteria met. End-to-end verified in Telegram. |
| 2 — Tasks, gamification, reminders, i18n | ✅ shipped, partial verification | Multi-goal aggregation + cache + goal delete fixed. Reminders cron live but not yet UAT'd. |
| Wave 1 (real AI + Stars hooks) | ⏳ in flight | OpenRouter integrated, Stars webhook wired. AI fallback bug under diagnosis. |
| Wave 2 (privacy + referrals + admin stats) | pending | Will start after Wave 1 issue closed. |
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

1. **Diagnose AI plan stub fallback** — use new diagnostic logging from commit `7f26901` after the next plan-gen attempt. The MCP-Timeweb is now configured in `~/.claude.json` so the next session can pull logs directly.
2. **Generate Prisma baseline migration** before going public — current code uses `db push` which is fine for dev but loses migration history.
3. **Switch backend bot from long-polling to webhook** — set `TELEGRAM_WEBHOOK_URL` once we have a stable HTTPS endpoint.
4. **Wave 2 work** — privacy + ToS pages, referral link UI, `/admin/stats` endpoint.
5. **Telegram Stars** — flip `TELEGRAM_STARS_ENABLED=true`, run an end-to-end Stars test.

## Quick links

- [HANDOFF.md](HANDOFF.md) — full session handoff (read this first)
- [PROJECT.md](PROJECT.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
- [ROADMAP.md](ROADMAP.md)
- [DEPLOY-TIMEWEB.md](DEPLOY-TIMEWEB.md)
- [research/SUMMARY.md](research/SUMMARY.md)
