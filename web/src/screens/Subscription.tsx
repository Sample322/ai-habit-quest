import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { openInvoice } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';

export function Subscription({
  lang,
  onClose,
  onActivated,
}: {
  lang: Lang;
  onClose: () => void;
  onActivated: () => void | Promise<void>;
}) {
  const i = t(lang);
  const [prices, setPrices] = useState<{ trialPriceRub: number; monthlyPriceRub: number; premiumStars: number } | null>(null);
  const [busy, setBusy] = useState<'yk' | 'stars' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void (async () => setPrices(await api.prices()))(); }, []);

  async function startTrial() {
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

  async function payStars() {
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-card p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
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
        {error && <div className="text-xs text-danger">{error}</div>}
      </div>
    </div>
  );
}
