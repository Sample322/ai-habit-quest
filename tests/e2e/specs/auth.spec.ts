import { test, expect } from '@playwright/test';

const BACKEND = process.env.BACKEND_URL ?? 'https://sample322-ai-habit-quest-55ff.twc1.net';

test.describe('auth', () => {
  test('telegram auth rejects empty initData', async ({ request }) => {
    const r = await request.post(BACKEND + '/auth/telegram', {
      data: { initData: '' },
    });
    expect([400, 401]).toContain(r.status());
  });

  test('telegram auth rejects forged initData', async ({ request }) => {
    const r = await request.post(BACKEND + '/auth/telegram', {
      data: { initData: 'auth_date=1&hash=deadbeef&user=%7B%22id%22%3A1%7D' },
    });
    expect(r.status()).toBe(401);
  });
});
