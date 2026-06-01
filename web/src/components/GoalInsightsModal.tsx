import { useEffect, useState } from 'react';
import { X, Calendar, Target, CheckCircle2 } from 'lucide-react';

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
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-card border border-hairline shadow-card w-full max-w-md p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {!data ? (
          <div className="h-48 grid place-items-center">
            <div className="text-muted text-sm">{i.loading}</div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="eyebrow text-accent">{i.progress.heatmap}</div>
                <div className="text-lg font-bold mt-0.5 leading-tight truncate">{data.goalTitle}</div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 -mr-2 -mt-2 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <InsightStat
                icon={<Calendar size={13} className="text-accent" />}
                label={i.progress.goalDay}
                value={`${data.dayIndex}`}
                sub={`${i.progress.goalOf} ${data.horizonDays}`}
              />
              <InsightStat
                icon={<Target size={13} className="text-warning" />}
                label={i.progress.goalCompletion}
                value={`${data.completionPct}%`}
              />
              <InsightStat
                icon={<CheckCircle2 size={13} className="text-positive" />}
                label="✓"
                value={`${data.completedAllTime}`}
                sub={`/ ${data.totalAllTime}`}
              />
            </div>

            <Heatmap days={data.heatmap} />

            <button onClick={onClose} className="btn-ghost">
              {i.common.cancel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function InsightStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="surface">
      <div className="eyebrow flex items-center gap-1">{icon}{label}</div>
      <div className="hud-num text-xl mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5 tabular">{sub}</div>}
    </div>
  );
}

function Heatmap({ days }: { days: { date: string; total: number; done: number }[] }) {
  return (
    <div className="space-y-2">
      <div className="eyebrow text-muted">30 d</div>
      <div className="grid grid-cols-10 gap-1.5">
        {days.map((d) => {
          const ratio = d.total === 0 ? 0 : d.done / d.total;
          const isEmpty = d.total === 0;
          const isPerfect = ratio === 1;
          const op = isEmpty ? 0.08 : 0.25 + ratio * 0.75;
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.done}/${d.total}`}
              className="aspect-square rounded-sm transition"
              style={{
                background: isEmpty
                  ? 'rgba(255,255,255,0.06)'
                  : isPerfect
                  ? 'linear-gradient(135deg,#19d57a 0%,#5fe3a6 100%)'
                  : 'linear-gradient(135deg,#7c5cff 0%,#9b7dff 100%)',
                opacity: op,
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted">
        <span>0</span>
        <div className="flex gap-0.5">
          {[0.2, 0.4, 0.6, 0.8, 1].map((v) => (
            <span
              key={v}
              className="w-3 h-3 rounded-sm"
              style={{
                background: v === 1
                  ? 'linear-gradient(135deg,#19d57a 0%,#5fe3a6 100%)'
                  : 'linear-gradient(135deg,#7c5cff 0%,#9b7dff 100%)',
                opacity: v,
              }}
            />
          ))}
        </div>
        <span>100%</span>
      </div>
    </div>
  );
}
