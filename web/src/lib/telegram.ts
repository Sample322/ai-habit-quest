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
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy') => void;
    notificationOccurred: (type: 'success' | 'error' | 'warning') => void;
  };
  openLink: (url: string) => void;
  openInvoice: (url: string, callback?: (status: string) => void) => void;
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

export function ready(): void {
  const tg = getWebApp();
  if (tg) {
    tg.ready();
    tg.expand();
  }
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
