# State — AI Habit Quest

**Initialized:** 2026-05-27
**Phase 1 closed:** 2026-05-29
**Current phase:** Phase 2 — Tasks, gamification, reminders, i18n (largely shipped, needs real-world verification)
**Status:** live on Timeweb Cloud, end-to-end loop verified in Telegram

## Phase progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Foundation & day-1 loop | ✅ **done** (2026-05-29) | All 4 success criteria met. Live at sample322-ai-habit-quest-{55ff,e620,52cd}.twc1.net |
| 2 — Tasks, gamification, reminders, i18n | code shipped, needs UAT | Daily tasks ✓, streak/XP ✓ already exercised. Bot reminders + language switch + free-tier limits — not yet verified live. |
| 3 — Monetisation & admin | pending | YooKassa credentials not yet provided |
| 4 — Growth & launch checklist | pending | Referral links, public offer, marketing |

## Live URLs

- web: https://sample322-ai-habit-quest-52cd.twc1.net
- backend: https://sample322-ai-habit-quest-55ff.twc1.net
- ai: https://sample322-ai-habit-quest-e620.twc1.net

## Open follow-ups

- [x] Telegram bot username locked to `AI_Habit_Tracking_bot` (token kept per user's call — not rotated).
- [ ] Provide YooKassa shopId + secret when Phase 3 starts.
- [ ] Decide on production AI host. Phase-3 plan: ship MVP on Timeweb Apps with `AI_PROVIDER=stub`; later provision a Timeweb GPU VPS for Ollama and flip the env var.
- [ ] User to create GitHub repo and push the existing commits, then connect Timeweb to it.
- [ ] User to create Timeweb account, top up balance, and follow `DEPLOY-TIMEWEB.md`.

## Quick links

- [PROJECT.md](PROJECT.md)
- [REQUIREMENTS.md](REQUIREMENTS.md)
- [ROADMAP.md](ROADMAP.md)
- [DEPLOY-TIMEWEB.md](DEPLOY-TIMEWEB.md)
- [research/SUMMARY.md](research/SUMMARY.md)
