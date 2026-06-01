import { useEffect, useState } from 'react';
import { Crown, Check, X, Sparkles, Infinity as InfinityIcon } from 'lucide-react';

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
      <Header title={i.subscription.activeTitle} onClose={onClose} />

      {/* Premium hero */}
      <div className="card aurora p-6 text-center space-y-3">
        <div className="mx-auto w-14 h-14 rounded-pill grid place-items-center bg-accentGrad shadow-glow">
          <Crown size={26} className="text-white" />
        </div>
        <div className="shimmer text-xl font-bold">{i.subscription.activeTitle}</div>
        {isAdminSentinel ? (
          <>
            <div className="flex items-center justify-center gap-2">
              <InfinityIcon size={28} className="text-accentGlow" />
              <div className="text-2xl font-bold">{i.subscription.activeForever}</div>
            </div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-accent">{i.subscription.activeAdminBadge}</div>
          </>
        ) : untilLabel ? (
          <>
            <div className="eyebrow">{i.subscription.activeUntil}</div>
            <div className="text-xl font-bold">{untilLabel}</div>
          </>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="eyebrow px-1">{i.subscription.activeIncludes}</div>
        <BenefitList i={i} />
      </div>
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
      <Header title={i.subscription.title} onClose={onClose} />

      <div className="card aurora p-6 text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-pill grid place-items-center bg-accentGrad shadow-glow">
          <Crown size={26} className="text-white" />
        </div>
        <div className="shimmer text-2xl font-bold tracking-tight">Pro</div>
        <div className="text-sm text-muted leading-snug">
          {i.subscription.title} · AI · {i.today.streak}
        </div>
      </div>

      <BenefitList i={i} />

      <div className="space-y-2">
        <button onClick={startTrial} disabled={busy !== null} className="btn-primary">
          {busy === 'yk' ? '…' : i.subscription.trial}
        </button>
        <div className="text-xs text-muted text-center">{i.subscription.monthly}</div>
        {prices && (
          <button onClick={payStars} disabled={busy !== null} className="btn-ghost flex items-center justify-center gap-2">
            <Sparkles size={14} className="text-accent" />
            {busy === 'stars' ? '…' : `${i.subscription.stars} (${prices.premiumStars} ⭐)`}
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

function BenefitList({ i }: { i: ReturnType<typeof t> }) {
  const items = [i.subscription.benefit1, i.subscription.benefit2, i.subscription.benefit3, i.subscription.benefit4];
  return (
    <ul className="space-y-1.5">
      {items.map((b) => (
        <li key={b} className="surface flex items-center gap-3 py-3">
          <span className="shrink-0 w-6 h-6 rounded-pill grid place-items-center bg-positive/15">
            <Check size={13} strokeWidth={3} className="text-positive" />
          </span>
          <span className="text-sm font-medium">{b}</span>
        </li>
      ))}
    </ul>
  );
}

function Header({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      <button
        onClick={onClose}
        aria-label="Close"
        className="w-9 h-9 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg w-full max-w-md rounded-t-3xl sm:rounded-card p-6 space-y-4 border border-hairline shadow-card max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
