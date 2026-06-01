import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import type { GoalInsights } from '../lib/types';

interface Props {
  lang: Lang;
  goalId: string;
  onClose: () => void;
}

export function GoalInsightsModal({ lang, goalId, onClose }: Props) {
  const i = t(lang);
  const [data, setData] = useState<GoalInsights | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await api.goalInsights(goalId));
      } catch {
        /* non-fatal */
      }
    })();
  }, [goalId]);

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-bg rounded-card border border-white/10 w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        {!data ? (
          <div className="text-muted text-sm">{i.loading}</div>
        ) : (
          <>
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{i.progress.heatmap}</div>
              <div className="text-lg font-semibold mt-0.5 truncate">{data.goalTitle}</div>
              <div className="text-[11px] text-muted mt-1">
                {i.progress.goalDay} {data.dayIndex} {i.progress.goalOf} {data.horizonDays} ·{' '}
                {i.progress.goalCompletion}: {data.completionPct}% ({data.completedAllTime}/{data.totalAllTime})
              </div>
            </div>
            <Heatmap days={data.heatmap} />
            <button
              onClick={onClose}
              className="w-full rounded-card border border-white/10 text-muted hover:text-text py-2 text-sm transition"
            >
              {i.common.cancel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Heatmap({ days }: { days: GoalInsights['heatmap'] }) {
  // 30 days arranged 6 cols x 5 rows (column = ~5-day chunk). Latest day is bottom-right.
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {days.map((d) => {
        const ratio = d.total === 0 ? 0 : d.done / d.total;
        const op = ratio === 0 ? (d.total === 0 ? 0.08 : 0.2) : 0.3 + ratio * 0.7;
        return (
          <div
            key={d.date}
            title={`${d.date}: ${d.done}/${d.total}`}
            className="aspect-square rounded bg-positive"
            style={{ opacity: op }}
          />
        );
      })}
    </div>
  );
}
