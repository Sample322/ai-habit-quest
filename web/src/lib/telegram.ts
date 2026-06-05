// Thin wrapper around the global Telegram.WebApp object that the
// telegram-web-app.js script (loaded in index.html) attaches to window.
// Outside Telegram (e.g. local browser preview) we degrade gracefully.

interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: {
      id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    start_param?: string;
  };
  themeParams: Record<string, string>;
  colorScheme: 'light' | 'dark';
  ready: () => void;
  expand: () => void;
  close: () => void;
  /** TG 6.0+: visible Web App height after the last stable state. Excludes
   *  chrome painted *over* the WebView (sheet close-button strip). */
  viewportStableHeight?: number;
  /** TG ≥ 6.7: 'ios' | 'android' | 'tdesktop' | 'web' | 'macos' | etc. */
  platform?: string;
  /** TG 8.0+: ask the client to drop the sheet chrome and use the full screen. */
  requestFullscreen?: () => void;
  isFullscreen?: boolean;
  /** TG 8.0+: actual px chrome covers around the WebView. */
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  /** TG 8.0+: px the WebView content has to clear so it isn't under chrome. */
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  /** TG WebApp event bus. */
  onEvent?: (event: string, handler: () => void) => void;
  offEvent?: (event: string, handler: () => void) => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'success' | 'error' | 'warning') => void;
  };
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
  /** TG WebApp ≥ 7.8: open the Stories editor with the given media URL. */
  shareToStory?: (
    mediaUrl: string,
    params?: { text?: string; widget_link?: { url: string; name?: string } },
  ) => void;
  /** Approximate WebApp API version: '7.8', '8.0', etc. */
  version?: string;
  MainButton: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

// Match tailwind.config.ts `colors.bg` so Telegram's chrome (header strip,
// home-indicator area) matches the app body — no light/dark split-bar.
const ONYX_BG = '#08090c';

/**
 * Mirror TG's reported safe-area / content-safe-area inset values into CSS
 * custom properties so layout (.app-safe-top, .app-safe-bottom) can absorb
 * the inline-sheet chrome the WebView is painted under. Re-runs on every
 * `safeAreaChanged` and `contentSafeAreaChanged` event the client emits.
 */
function syncSafeAreaVars(tg: TelegramWebApp): void {
  const root = document.documentElement;
  // Three signals for "how many px does the chrome cover at the top":
  //  1. contentSafeAreaInset.top — TG 8.0+, reports the chrome strip height
  //     in inline-sheet launches.
  //  2. safeAreaInset.top — TG 8.0+ device safe-area (OS notch).
  //  3. window.innerHeight - viewportStableHeight — when TG paints chrome
  //     OVER the WebView (inline sheet), the WebView itself is full screen
  //     but viewportStableHeight reports the chrome-free area. The diff is
  //     the chrome strip height. In menu-button mode TG renders the header
  //     ABOVE the WebView so the diff is 0. This is the most reliable
  //     fallback when (1) and (2) aren't emitted (TG < 8.0 inline mode).
  const ct = tg.contentSafeAreaInset?.top ?? 0;
  const st = tg.safeAreaInset?.top ?? 0;
  const stable = tg.viewportStableHeight ?? window.innerHeight;
  const chromeOverlay = Math.max(0, window.innerHeight - stable);
  // iOS TG does NOT reliably report chrome height through any of the three
  // signals above when launched via an inline "Открыть приложение" button.
  // Empirically the sheet close-button + drag-handle strip is ~80–100px on
  // modern iPhones, so force a 100px floor on iOS. On menu-button launches
  // this adds a slight gap but never overlaps; on inline launches it covers
  // the overlap even when the API stays silent.
  const iosFloor = tg.platform === 'ios' ? 100 : 0;
  const top = Math.max(ct, st, chromeOverlay, iosFloor);

  const cb = tg.contentSafeAreaInset?.bottom ?? 0;
  const sb = tg.safeAreaInset?.bottom ?? 0;
  const bottom = Math.max(cb, sb);

  if (top > 0) root.style.setProperty('--tg-safe-top', `${top}px`);
  else root.style.removeProperty('--tg-safe-top');
  if (bottom > 0) root.style.setProperty('--tg-safe-bottom', `${bottom}px`);
  else root.style.removeProperty('--tg-safe-bottom');
}

let readyCalled = false;

export function ready(): void {
  const tg = getWebApp();
  if (!tg) return;
  // React StrictMode runs effects twice in dev — without this guard the
  // safeAreaChanged handlers would be subscribed twice and the inset CSS
  // var would be written twice per event (idempotent but wasteful).
  if (readyCalled) return;
  readyCalled = true;
  tg.ready();
  tg.expand();
  // NOTE: do NOT call tg.requestFullscreen(). On TG 8.0+ that forces the
  // WebView under the chrome strip — which is exactly what causes the
  // close-button overlap in BOTH menu-button and inline-button launches.
  // Leaving fullscreen to TG's defaults keeps the close-button drawer
  // *above* the WebView in menu-button mode (matching desktop behaviour),
  // and the safe-area inset handler below still pads inline-sheet launches.
  // Force Telegram's surrounding chrome to our dark palette regardless of
  // the user's TG theme. Older clients may not have these methods — fail
  // soft.
  try { tg.setHeaderColor?.(ONYX_BG); } catch { /* ignore */ }
  try { tg.setBackgroundColor?.(ONYX_BG); } catch { /* ignore */ }
  try { tg.setBottomBarColor?.(ONYX_BG); } catch { /* ignore */ }
  // Initial inset sync + subscribe to TG's safe-area events so rotation or
  // fullscreen toggle updates layout live.
  syncSafeAreaVars(tg);
  try {
    const handler = () => syncSafeAreaVars(tg);
    tg.onEvent?.('safeAreaChanged', handler);
    tg.onEvent?.('contentSafeAreaChanged', handler);
    tg.onEvent?.('fullscreenChanged', handler);
    tg.onEvent?.('viewportChanged', handler);
  } catch { /* ignore */ }
}

export function getInitData(): string {
  const tg = getWebApp();
  if (tg?.initData) return tg.initData;
  // Local dev fallback: build a fake initData so the backend can be exercised
  // when AHQ_DEV_FAKE_INITDATA is set in the host page.
  const fake = (window as unknown as { AHQ_DEV_INITDATA?: string }).AHQ_DEV_INITDATA;
  return fake ?? '';
}

export function detectLanguage(): 'ru' | 'en' {
  const code = getWebApp()?.initDataUnsafe?.user?.language_code?.slice(0, 2);
  return code === 'en' ? 'en' : 'ru';
}

export function haptic(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  getWebApp()?.HapticFeedback?.impactOccurred(style);
}

export function notify(type: 'success' | 'error' | 'warning'): void {
  getWebApp()?.HapticFeedback?.notificationOccurred(type);
}

export function openInvoice(url: string, cb?: (status: string) => void): void {
  const tg = getWebApp();
  if (tg && tg.openInvoice) tg.openInvoice(url, cb);
  else window.open(url, '_blank', 'noopener');
}

/**
 * Check whether the Telegram WebApp supports the Stories share method.
 * Older clients don't ship it so we have to fall back gracefully.
 */
export function canShareToStory(): boolean {
  const tg = getWebApp();
  if (!tg || typeof tg.shareToStory !== 'function') return false;
  const v = tg.version ?? '6.0';
  const [major, minor] = v.split('.').map(Number);
  return major > 7 || (major === 7 && minor >= 8);
}

/** TG ≥ 7.8: open the Stories editor with a public image URL pre-loaded. */
export function shareToStory(mediaUrl: string, text?: string, widgetUrl?: string): boolean {
  const tg = getWebApp();
  if (!canShareToStory() || !tg?.shareToStory) return false;
  tg.shareToStory(mediaUrl, {
    text,
    widget_link: widgetUrl ? { url: widgetUrl, name: 'AI Habit Quest' } : undefined,
  });
  return true;
}

/** Open Telegram's native share sheet for a link (used for referrals). */
export function shareUrl(url: string, text: string): void {
  const tg = getWebApp();
  const share = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(share);
  else window.open(share, '_blank', 'noopener');
}

/** Best-effort clipboard copy; returns whether it likely succeeded. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
