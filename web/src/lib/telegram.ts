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

export function ready(): void {
  const tg = getWebApp();
  if (!tg) return;
  tg.ready();
  tg.expand();
  // Force Telegram's surrounding chrome to our dark palette regardless of
  // the user's TG theme. Older clients may not have these methods — fail
  // soft.
  try { tg.setHeaderColor?.(ONYX_BG); } catch { /* ignore */ }
  try { tg.setBackgroundColor?.(ONYX_BG); } catch { /* ignore */ }
  try { tg.setBottomBarColor?.(ONYX_BG); } catch { /* ignore */ }
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
