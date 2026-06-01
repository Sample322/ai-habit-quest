import { useState } from 'react';
import { Gift, Share2, Copy, Check } from 'lucide-react';

import { t, type Lang } from '../lib/i18n';
import type { User } from '../lib/types';
import { shareUrl, copyText, haptic, notify } from '../lib/telegram';

const BOT_USERNAME = import.meta.env.VITE_TG_BOT_USERNAME || 'AI_Habit_Tracking_bot';

export function ReferralCard({ lang, user }: { lang: Lang; user: User }): JSX.Element {
  const i = t(lang);
  const link = `https://t.me/${BOT_USERNAME}?startapp=ref_${user.referralCode}`;
  const [copied, setCopied] = useState(false);

  async function copy(): Promise<void> {
    haptic('light');
    const ok = await copyText(link);
    if (ok) {
      setCopied(true);
      notify('success');
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <section className="card aurora p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center bg-accentGrad shadow-glow">
          <Gift size={18} className="text-white" />
        </span>
        <div className="min-w-0">
          <div className="font-semibold text-base leading-tight">{i.referral.title}</div>
          <div className="text-xs text-muted mt-0.5 leading-snug">{i.referral.subtitle}</div>
        </div>
        <div className="ml-auto text-right shrink-0">
          <div className="text-2xl font-bold tabular leading-none">{user.referralCount}</div>
          <div className="eyebrow mt-1">{i.referral.invited}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => { haptic('light'); shareUrl(link, i.referral.shareText); }}
          className="rounded-pill bg-white text-bg font-semibold py-2.5 text-sm transition active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          <Share2 size={14} strokeWidth={2.5} />
          {i.referral.share}
        </button>
        <button
          onClick={copy}
          className="rounded-pill border border-hairlineStrong text-text bg-white/[0.02] hover:bg-white/[0.05] py-2.5 text-sm transition active:scale-[0.98] flex items-center justify-center gap-1.5"
        >
          {copied ? (
            <>
              <Check size={14} strokeWidth={2.5} className="text-positive" />
              {i.referral.copied}
            </>
          ) : (
            <>
              <Copy size={14} strokeWidth={2.2} />
              {i.referral.copy}
            </>
          )}
        </button>
      </div>
    </section>
  );
}
