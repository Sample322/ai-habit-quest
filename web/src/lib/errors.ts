// Tiny error reporter. If VITE_ERROR_REPORT_URL is set, POSTs structured
// error events there (you can point it at your own collector, Sentry's
// envelope endpoint, Logflare, etc.). No npm dependency on @sentry/react —
// we control the bundle cost. Falls back to console in dev.

interface ErrorPayload {
  message: string;
  stack?: string;
  url?: string;
  ua?: string;
  ts: number;
  release?: string;
  tags?: Record<string, string>;
  context?: Record<string, unknown>;
}

const ENDPOINT = import.meta.env.VITE_ERROR_REPORT_URL as string | undefined;
const RELEASE = (import.meta.env.VITE_GIT_SHA as string | undefined) || 'dev';

function send(payload: ErrorPayload): void {
  if (!ENDPOINT) {
    if (import.meta.env.DEV) console.error('[ahq error]', payload);
    return;
  }
  try {
    void fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => { /* swallow */ });
  } catch { /* swallow */ }
}

export function reportError(err: unknown, ctx?: Record<string, unknown>): void {
  const e = err as Error | undefined;
  send({
    message: e?.message ?? String(err),
    stack: e?.stack,
    url: typeof location !== 'undefined' ? location.href : undefined,
    ua: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    ts: Date.now(),
    release: RELEASE,
    context: ctx,
  });
}

/**
 * Wire up window-level handlers. Call once at boot.
 */
export function installErrorHandlers(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('error', (ev) => {
    reportError(ev.error ?? ev.message, { type: 'window.error', filename: ev.filename, line: ev.lineno });
  });
  window.addEventListener('unhandledrejection', (ev) => {
    reportError(ev.reason, { type: 'unhandledrejection' });
  });
}
