import { test, expect } from '@playwright/test';

const WEB = process.env.WEB_URL ?? 'https://sample322-ai-habit-quest-0676.twc1.net';
const BACKEND = process.env.BACKEND_URL ?? 'https://sample322-ai-habit-quest-55ff.twc1.net';
const AI = process.env.AI_URL ?? 'https://sample322-ai-habit-quest-71a2.twc1.net';

test.describe('infrastructure smoke', () => {
  test('web index responds 200 + serves bundle', async ({ request }) => {
    const r = await request.get(WEB + '/', { timeout: 10_000 });
    expect(r.status()).toBe(200);
    const html = await r.text();
    expect(html).toContain('AI Habit Quest');
    expect(html).toContain('telegram-web-app.js');
  });

  test('backend /health returns ok', async ({ request }) => {
    const r = await request.get(BACKEND + '/health', { timeout: 10_000 });
    expect(r.status()).toBe(200);
  });

  test('backend /bot/status returns webhook mode', async ({ request }) => {
    const r = await request.get(BACKEND + '/bot/status', { timeout: 10_000 });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(['webhook', 'long-polling']).toContain(body.mode);
  });

  test('ai-service /healthz is reachable', async ({ request }) => {
    const r = await request.get(AI + '/healthz', { timeout: 10_000 });
    expect(r.status()).toBe(200);
  });

  test('privacy + terms pages are served', async ({ request }) => {
    const p = await request.get(WEB + '/privacy.html');
    const t = await request.get(WEB + '/terms.html');
    expect(p.status()).toBe(200);
    expect(t.status()).toBe(200);
  });
});
