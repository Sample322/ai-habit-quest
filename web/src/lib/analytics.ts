// Lightweight client-side event tracking. Privacy-first — no cookies, no
// PII. Sends to Plausible if VITE_PLAUSIBLE_DOMAIN is set, otherwise a no-op
// (so local dev + missing env are safe).

interface PlausibleProps {
  [key: string]: string | number | boolean | null | undefined;
}

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: PlausibleProps }) => void;
  }
}

const DOMAIN = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;
const ENDPOINT =
  (import.meta.env.VITE_PLAUSIBLE_ENDPOINT as string | undefined) ||
  'https://plausible.io/api/event';

// Inject the official script once on first use so the helper Just Works
// even when index.html doesn't have it. No-op if the domain is unset.
let injected = false;
function ensureScript(): void {
  if (injected || !DOMAIN) return;
  if (window.plausible) { injected = true; return; }
  const s = document.createElement('script');
  s.defer = true;
  s.dataset.domain = DOMAIN;
  s.src = ENDPOINT.replace(/\/api\/event$/, '/js/script.js');
  document.head.appendChild(s);
  injected = true;
}

/** Fire-and-forget event with optional structured props. */
export function track(event: string, props?: PlausibleProps): void {
  if (!DOMAIN) return;
  ensureScript();
  try {
    if (typeof window.plausible === 'function') {
      window.plausible(event, props ? { props } : undefined);
      return;
    }
    // Script not yet loaded — fall back to a direct POST so the event isn't
    // lost during the bootstrap window.
    void fetch(ENDPOINT, {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: event,
        domain: DOMAIN,
        url: window.location.href,
        props: props ?? undefined,
      }),
    }).catch(() => { /* swallow */ });
  } catch {
    /* swallow */
  }
}
