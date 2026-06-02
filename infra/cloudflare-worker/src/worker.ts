/**
 * AI Habit Quest — Telegram bot proxy on Cloudflare Workers.
 *
 * Solves the "Russian host can't reach api.telegram.org reliably" problem by
 * sitting between the bot and Telegram for both directions:
 *
 *   1. OUTBOUND (backend → Telegram)
 *      Backend's grammy client is configured with apiRoot = this Worker.
 *      Any request to /bot<TOKEN>/<method> is forwarded verbatim to
 *      https://api.telegram.org/bot<TOKEN>/<method>.
 *
 *   2. INBOUND (Telegram → backend)
 *      Telegram delivers updates to this Worker at POST /webhook.
 *      The Worker validates the X-Telegram-Bot-Api-Secret-Token header
 *      against WEBHOOK_SECRET, then forwards the JSON body to the backend at
 *      `${BACKEND_BASE}/bot/webhook` with the same header set so the backend
 *      can re-validate independently.
 *
 * Required environment variables (set via `wrangler secret put` or dashboard):
 *
 *   BACKEND_BASE         e.g. https://sample322-ai-habit-quest-55ff.twc1.net
 *   WEBHOOK_SECRET       random 32+ chars, shared with Telegram (setWebhook)
 *                        and the backend (TELEGRAM_WEBHOOK_SECRET)
 *
 * Health endpoint: GET / returns "ok" so wrangler/Cloudflare/uptime can ping.
 */

export interface Env {
  BACKEND_BASE: string;
  WEBHOOK_SECRET: string;
}

const TELEGRAM_API = 'https://api.telegram.org';

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check.
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } });
    }

    // Inbound webhook from Telegram.
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
      if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }
      if (!env.BACKEND_BASE) {
        return new Response('BACKEND_BASE not configured', { status: 500 });
      }

      const target = `${env.BACKEND_BASE.replace(/\/+$/, '')}/bot/webhook`;
      const body = await request.arrayBuffer();
      // Forward to the backend. Re-include the secret header so the backend
      // can verify the request came through the Worker, not directly.
      const forwarded = await fetch(target, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Telegram-Bot-Api-Secret-Token': secret,
        },
        body,
      });
      // Telegram doesn't care about the response body, only the status.
      // Always respond 200 so Telegram doesn't retry on transient backend
      // errors — the backend has its own retry/idempotency.
      void forwarded;
      return new Response('ok', { status: 200 });
    }

    // Outbound proxy: anything starting with /bot<TOKEN>/ is forwarded to
    // api.telegram.org with the same path, method, headers, and body.
    if (url.pathname.startsWith('/bot')) {
      const upstreamUrl = `${TELEGRAM_API}${url.pathname}${url.search}`;
      // Strip CF-injected headers that confuse Telegram (cf-*, x-real-ip, ...).
      const cleanHeaders = new Headers();
      for (const [k, v] of request.headers.entries()) {
        if (k.startsWith('cf-') || k.startsWith('x-real-')) continue;
        if (k === 'host') continue;
        cleanHeaders.set(k, v);
      }
      const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: cleanHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      });
      // Pass through the response as-is so grammy sees the raw Telegram payload.
      return new Response(upstream.body, {
        status: upstream.status,
        headers: upstream.headers,
      });
    }

    return new Response('not found', { status: 404 });
  },
};
