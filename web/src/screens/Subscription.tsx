import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { openInvoice } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { User } from '../lib/types';

interface SubscriptionProps {
  lang: Lang;
  user: User;
  onClose: () => void;
  onActivated: () => void | Promise<void>;
}

const ADMIN_PREMIUM_YEAR_SENTINEL = 2099;

export function Subscription({ lang, user, onClose, onActivated }: SubscriptionProps): JSX.Element {
  const i = t(lang);

  if (user.isPremium) {
    return <ActiveSubscription lang={lang} user={user} onClose={onClose} />;
  }

  return <UpgradeSubscription lang={lang} i={i} onClose={onClose} onActivated={onActivated} />;
}

function ActiveSubscription({ lang, user, onClose }: { lang: Lang; user: User; onClose: () => void }): JSX.Element {
  const i = t(lang);
  const until = user.premiumUntil ? new Date(user.premiumUntil) : null;
  const isAdminSentinel = until !== null && until.getUTCFullYear() === ADMIN_PREMIUM_YEAR_SENTINEL;
  const untilLabel = until
    ? until.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Backdrop onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <span>⭐</span>
          <span>{i.subscription.activeTitle}</span>
        </h2>
        <button onClick={onClose} className="text-muted text-sm">{i.subscription.activeOk}</button>
      </div>

      <div className="surface bg-black/20 space-y-1">
        {isAdminSentinel ? (
          <>
            <div className="text-xs text-muted">{i.subscription.activeUntil}</div>
            <div className="text-lg font-semibold">∞ {i.subscription.activeForever}</div>
            <div className="text-[11px] text-accent mt-1">{i.subscription.activeAdminBadge}</div>
          </>
        ) : untilLabel ? (
          <>
            <div className="text-xs text-muted">{i.subscription.activeUntil}</div>
            <div className="text-lg font-semibold">{untilLabel}</div>
          </>
        ) : null}
      </div>

      <div className="text-sm text-muted">{i.subscription.activeIncludes}</div>
      <ul className="space-y-2 text-sm">
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit1}</li>
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit2}</li>
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit3}</li>
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit4}</li>
      </ul>
    </Backdrop>
  );
}

interface UpgradeSubscriptionProps {
  lang: Lang;
  i: ReturnType<typeof t>;
  onClose: () => void;
  onActivated: () => void | Promise<void>;
}

function UpgradeSubscription({ lang, i, onClose, onActivated }: UpgradeSubscriptionProps): JSX.Element {
  const [prices, setPrices] = useState<{ trialPriceRub: number; monthlyPriceRub: number; premiumStars: number } | null>(null);
  const [busy, setBusy] = useState<'yk' | 'stars' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => setPrices(await api.prices()))();
  }, []);

  async function startTrial(): Promise<void> {
    setBusy('yk');
    setError(null);
    try {
      const { confirmationUrl } = await api.startYooKassaTrial();
      window.open(confirmationUrl, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : i.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  async function payStars(): Promise<void> {
    setBusy('stars');
    setError(null);
    try {
      const { invoiceLink } = await api.starsInvoice();
      openInvoice(invoiceLink, async (status) => {
        if (status === 'paid') await onActivated();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : i.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  void lang;
  return (
    <Backdrop onClose={onClose}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">⭐ {i.subscription.title}</h2>
        <button onClick={onClose} className="text-muted text-sm">{i.subscription.close}</button>
      </div>

      <ul className="space-y-2 text-sm">
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit1}</li>
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit2}</li>
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit3}</li>
        <li className="flex gap-2"><span>✓</span>{i.subscription.benefit4}</li>
      </ul>

      <div className="space-y-3">
        <button onClick={startTrial} disabled={busy !== null} className="btn-primary">
          {busy === 'yk' ? '...' : i.subscription.trial}
        </button>
        <div className="text-xs text-muted text-center">{i.subscription.monthly}</div>
        {prices && (
          <button onClick={payStars} disabled={busy !== null} className="btn-ghost">
            {busy === 'stars' ? '...' : `${i.subscription.stars} (${prices.premiumStars} ⭐)`}
          </button>
        )}
      </div>

      <div className="text-[11px] text-muted/80 leading-relaxed">{i.subscription.offer}</div>
      <div className="text-[11px] text-center text-muted/70 flex justify-center gap-3">
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
          {i.subscription.privacyLink}
        </a>
        <span>·</span>
        <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">
          {i.subscription.termsLink}
        </a>
      </div>
      {error && <div className="text-xs text-danger break-words">{error}</div>}
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-card p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
