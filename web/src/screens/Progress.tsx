import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import type { ProgressOverview, User } from '../lib/types';

export function Progress({ lang, user }: { lang: Lang; user: User }) {
  const i = t(lang);
  const [data, setData] = useState<ProgressOverview | null>(null);

  useEffect(() => {
    void (async () => setData(await api.progress()))();
  }, []);

  if (!data) return <div className="text-muted text-sm">{i.loading}</div>;

  return (
    <div className="space-y-5">
      <section className="grid grid-cols-3 gap-3">
        <Stat label={i.today.streak} value={`🔥 ${data.streakCurrent}`} sub={`${i.progress.bestStreak}: ${data.streakBest}`} />
        <Stat label={i.today.level} value={`Lv ${data.level}`} />
        <Stat label={i.today.xp} value={`${data.xpTotal}`} />
      </section>

      <section className="surface">
        <div className="text-xs text-muted mb-3">{i.progress.last7}</div>
        <div className="flex items-end gap-2">
          {data.last7.map((d) => {
            const ratio = d.total === 0 ? 0 : d.done / d.total;
            const heightPct = Math.max(6, Math.round(ratio * 100));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                {/* Fixed-height track so the fill % has a concrete box to grow in. */}
                <div className="w-full h-28 bg-bg rounded relative overflow-hidden">
                  <div
                    className="absolute bottom-0 inset-x-0 bg-accent rounded-b transition-all duration-500"
                    style={{ height: `${heightPct}%`, opacity: ratio === 0 ? 0.25 : 1 }}
                  />
                </div>
                <div className="text-[10px] text-muted tabular-nums">{d.done}/{d.total}</div>
                <div className="text-[10px] text-muted">{d.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {!user.isPremium && (
        <section className="surface text-sm text-muted">
          {i.today.premiumCta}
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted mt-1">{sub}</div>}
    </div>
  );
}
