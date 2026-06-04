/**
 * Optional Sentry bootstrap. Activated when VITE_SENTRY_DSN is set, otherwise
 * a no-op (so local dev + repos without DSN keep the bundle lean — the import
 * tree-shakes when the function never runs).
 *
 * Replays are disabled by default — Telegram WebView session recordings tend
 * to contain user goal text which we'd rather not ship to a third party.
 */
import * as Sentry from '@sentry/react';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = (import.meta.env.VITE_GIT_SHA as string | undefined) || 'dev';
const ENV = (import.meta.env.MODE as string | undefined) || 'production';

let initialised = false;

export function initSentry(): void {
  if (initialised || !DSN) return;
  Sentry.init({
    dsn: DSN,
    release: `ahq-web@${RELEASE}`,
    environment: ENV,
    // Keep it quiet: errors + a small fraction of perf traces. No PII, no
    // session replay by default.
    tracesSampleRate: 0.05,
    sendDefaultPii: false,
  });
  initialised = true;
}

/** Direct capture helper for places where we want explicit reporting. */
export function captureSentry(err: unknown, ctx?: Record<string, unknown>): void {
  if (!initialised) return;
  Sentry.captureException(err, ctx ? { extra: ctx } : undefined);
}
