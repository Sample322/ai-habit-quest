import { useEffect, useState } from 'react';
import { Crown, Check, X, Sparkles, Infinity as InfinityIcon, CreditCard, Gift } from 'lucide-react';

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

  return <UpgradeSubscription lang={lang} i={i} user={user} onClose={onClose} onActivated={onActivated} />;
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
  user: User;
  onClose: () => void;
  onActivated: () => void | Promise<void>;
}

function UpgradeSubscription({ lang, i, user, onClose, onActivated }: UpgradeSubscriptionProps): JSX.Element {
  const [prices, setPrices] = useState<{ trialPriceRub: number; monthlyPriceRub: number; premiumStars: number } | null>(null);
  const [busy, setBusy] = useState<'trial' | 'stars' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [methodOpen, setMethodOpen] = useState(false);

  useEffect(() => {
    void (async () => setPrices(await api.prices()))();
  }, []);

  async function claimTrial(): Promise<void> {
    if (user.hasUsedTrial) return;
    setBusy('trial');
    setError(null);
    try {
      await api.claimTrial();
      setInfo(i.subscription.freeTrialClaimed);
      await onActivated();
    } catch (err) {
      const code = ((err as { body?: { code?: string } }).body)?.code;
      if (code === 'trial_already_used') setError(i.subscription.freeTrialUsed);
      else setError(err instanceof Error ? err.message : i.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  async function payStars(): Promise<void> {
    setBusy('stars');
    setError(null);
    const timer = setTimeout(() => {
      setBusy((b) => (b === 'stars' ? null : b));
      setError(i.errors.generic);
    }, 20_000);
    try {
      const { invoiceLink } = await api.starsInvoice();
      openInvoice(invoiceLink, async (status) => {
        if (status === 'paid') await onActivated();
      });
      setMethodOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : i.errors.generic);
    } finally {
      clearTimeout(timer);
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

      <div className="space-y-2.5">
        <div className="eyebrow px-1">{i.subscription.payMethodLabel}</div>

        {/* Free trial — primary, one-time per account */}
        {!user.hasUsedTrial ? (
          <button
            onClick={claimTrial}
            disabled={busy !== null}
            className="btn-primary flex flex-col items-center gap-0.5"
          >
            <span className="flex items-center gap-2">
              <Gift size={16} />
              {busy === 'trial' ? '…' : i.subscription.freeTrialAction}
            </span>
            <span className="text-[11px] font-normal opacity-80">{i.subscription.freeTrialSub}</span>
          </button>
        ) : (
          <div className="rounded-pill border border-hairline bg-white/[0.02] py-3 px-5 text-center text-sm text-muted">
            <Gift size={14} className="inline mr-1.5 -mt-0.5 opacity-60" />
            {i.subscription.freeTrialUsed}
          </div>
        )}

        {/* Subscribe — opens method-picker modal */}
        <button
          onClick={() => setMethodOpen(true)}
          disabled={busy !== null}
          className="btn-ghost flex items-center justify-center gap-2"
        >
          <CreditCard size={14} className="text-accent" />
          {i.subscription.payAction}
        </button>
      </div>

      {info && (
        <div className="card border-positive/40 bg-positive/10 p-3 text-center text-sm text-text">
          {info}
        </div>
      )}

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

      {methodOpen && prices && (
        <PaymentMethodModal
          i={i}
          prices={prices}
          busy={busy === 'stars'}
          onStars={payStars}
          onClose={() => setMethodOpen(false)}
        />
      )}
    </Backdrop>
  );
}

function PaymentMethodModal({
  i, prices, busy, onStars, onClose,
}: {
  i: ReturnType<typeof t>;
  prices: { premiumStars: number };
  busy: boolean;
  onStars: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-card border border-hairline shadow-card w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">{i.subscription.payMethodPick}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-2 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2.5">
          {/* Stars */}
          <button
            onClick={onStars}
            disabled={busy}
            className="w-full card p-4 flex items-center gap-3 transition active:scale-[0.99] hover:border-hairlineStrong text-left disabled:opacity-50"
          >
            <span className="shrink-0 w-11 h-11 rounded-pill grid place-items-center bg-accentGrad shadow-glow">
              <Sparkles size={18} className="text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{i.subscription.payMethodStars}</div>
              <div className="text-[11px] text-muted mt-0.5">
                {i.subscription.payMethodStarsHint.replace('{n}', String(prices.premiumStars))}
              </div>
            </div>
            {busy ? <span className="text-muted text-sm">…</span> : <span className="text-muted text-lg">›</span>}
          </button>

          {/* Card — coming soon (YK pending approval) */}
          <div className="w-full card p-4 flex items-center gap-3 opacity-60 cursor-not-allowed">
            <span className="shrink-0 w-11 h-11 rounded-pill grid place-items-center border border-hairlineStrong bg-bg/40">
              <CreditCard size={18} className="text-muted" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                {i.subscription.payMethodCard}
                <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-pill bg-white/10 text-muted">
                  {i.subscription.payMethodCardSoon}
                </span>
              </div>
              <div className="text-[11px] text-muted mt-0.5">{i.subscription.payMethodCardHint}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BenefitList({ i }: { i: ReturnType<typeof t> }) {
  const items = [
    i.subscription.benefit1,
    i.subscription.benefit2,
    i.subscription.benefit3,
    i.subscription.benefit4,
    i.subscription.benefit5,
    i.subscription.benefit6,
  ];
  return (
    <ul className="space-y-1.5">
      {items.map((b) => (
        <li key={b} className="surface flex items-center gap-3 py-3">
          <span className="shrink-0 w-6 h-6 rounded-pill grid place-items-center bg-positive/15">
            <Check size={13} strokeWidth={3} className="text-positive" />
          </span>
          <span className="text-sm font-medium leading-snug">{b}</span>
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
