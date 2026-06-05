/**
 * Optional Sentry bootstrap. Activated when VITE_SENTRY_DSN is set, otherwise
 * the @sentry/react chunk never downloads (saves ~80 kB gzipped on the main
 * bundle for builds without a DSN).
 *
 * Replays are disabled by default — Telegram WebView session recordings tend
 * to contain user goal text which we'd rather not ship to a third party.
 */
type SentryNs = typeof import('@sentry/react');

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = (import.meta.env.VITE_GIT_SHA as string | undefined) || 'dev';
const ENV = (import.meta.env.MODE as string | undefined) || 'production';

let sentryNs: SentryNs | null = null;

export function initSentry(): void {
  if (sentryNs || !DSN) return;
  // Dynamic import keeps Sentry out of the main chunk when there's no DSN.
  void import('@sentry/react')
    .then((mod) => {
      sentryNs = mod;
      mod.init({
        dsn: DSN,
        release: `ahq-web@${RELEASE}`,
        environment: ENV,
        // Keep it quiet: errors + a small fraction of perf traces. No PII,
        // no session replay by default.
        tracesSampleRate: 0.05,
        sendDefaultPii: false,
        // Strip identifiable bits before the event leaves the device:
        //  - Authorization header (JWT) and Telegram initData query string
        //    can carry user IDs.
        //  - URL query strings can carry goal IDs / start params.
        beforeSend(event) {
          if (event.request?.headers) {
            delete event.request.headers['Authorization'];
            delete event.request.headers['authorization'];
            delete event.request.headers['Cookie'];
            delete event.request.headers['cookie'];
          }
          if (event.request?.query_string) event.request.query_string = '[redacted]';
          if (event.user) {
            // Keep the cuid as a stable anonymous handle; drop the rest.
            event.user = event.user.id ? { id: event.user.id } : undefined;
          }
          return event;
        },
      });
    })
    .catch(() => { /* offline / blocked — drop silently */ });
}

/** Direct capture helper for places where we want explicit reporting. */
export function captureSentry(err: unknown, ctx?: Record<string, unknown>): void {
  if (!sentryNs) return;
  sentryNs.captureException(err, ctx ? { extra: ctx } : undefined);
}
