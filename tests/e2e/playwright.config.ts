import { defineConfig, devices } from '@playwright/test';

/**
 * Production smoke tests. Runs against the live prod URLs by default;
 * override BASE_URL to test a different deployment.
 *
 * These tests skip the Telegram WebApp authentication flow (it requires
 * an HMAC-signed initData from the real Telegram client). Mini App-gated
 * endpoints are covered by the API-level suite via JWT mint instead.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.WEB_URL ?? 'https://sample322-ai-habit-quest-0676.twc1.net',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
