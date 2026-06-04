# AI Habit Quest — E2E smoke tests

Production smoke suite. Verifies the three Timeweb services + auth surface
are alive without depending on a real Telegram session.

## Setup

```bash
cd tests/e2e
npm install
npm run install:browsers
```

## Run

Against prod (default URLs):

```bash
npm test
```

Against a different deployment:

```bash
BACKEND_URL=https://staging-backend... WEB_URL=https://staging-web... npm test
```

## What it covers

- `health.spec.ts` — web index, backend `/health`, `/bot/status` (mode),
  ai-service `/health`, privacy + terms.
- `auth.spec.ts` — `/auth/telegram` rejects empty + forged initData.

## What it doesn't cover (yet)

- Full Mini App user journey (would need a stubbed Telegram WebApp). The
  Mini App-gated endpoints are exercised in `backend/test/` integration
  tests via JWT mint.
- Visual regression. Add later with `toHaveScreenshot()`.

## CI integration

```yaml
- run: cd tests/e2e && npm ci && npx playwright install --with-deps
- run: cd tests/e2e && npm test
```

The suite is fully self-contained: no backend mocking, no fixtures — it
hits live URLs read-only.
