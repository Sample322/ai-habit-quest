import { useState } from 'react';

import { t, type Lang } from '../lib/i18n';
import type { User } from '../lib/types';
import { shareUrl, copyText, haptic, notify } from '../lib/telegram';

const BOT_USERNAME = import.meta.env.VITE_TG_BOT_USERNAME || 'AI_Habit_Tracking_bot';

export function ReferralCard({ lang, user }: { lang: Lang; user: User }): JSX.Element {
  const i = t(lang);
  // Main Mini App deep link — `t.me/<bot>?startapp=` opens the bot's Main Mini
  // App with start_param=ref_<code> (no named-app short name required).
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
    <section className="rounded-card p-4 border border-accent/20 bg-gradient-to-br from-accent/10 to-transparent space-y-3">
      <div>
        <div className="font-semibold flex items-center gap-2"><span>🎁</span>{i.referral.title}</div>
        <div className="text-xs text-muted mt-1">{i.referral.subtitle}</div>
      </div>
      <div className="text-[11px] text-muted">
        {i.referral.invited}: <b className="text-text">{user.referralCount}</b>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => { haptic('light'); shareUrl(link, i.referral.shareText); }}
          className="flex-1 rounded-card bg-accent text-accentText font-medium py-2 text-sm transition active:opacity-80"
        >
          {i.referral.share}
        </button>
        <button
          onClick={copy}
          className="flex-1 rounded-card border border-white/15 text-muted py-2 text-sm transition active:opacity-80"
        >
          {copied ? i.referral.copied : i.referral.copy}
        </button>
      </div>
    </section>
  );
}
