import { useEffect, useState } from 'react';

import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import type { ProgressOverview, Leaderboard, User } from '../lib/types';

export function Progress({ lang, user }: { lang: Lang; user: User }) {
  const i = t(lang);
  const L = (ru: string, en: string): string => (lang === 'en' ? en : ru);
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);

  useEffect(() => {
    void (async () => setData(await api.progress()))();
    void (async () => { try { setBoard(await api.leaderboard()); } catch { /* non-fatal */ } })();
  }, []);

  if (!data) return <div className="text-muted text-sm">{i.loading}</div>;

  const earned = data.achievements.filter((a) => a.earned).length;

  return (
    <div className="space-y-5">
      {/* Rank card */}
      <section className="rounded-card p-5 bg-gradient-to-br from-accent/20 via-surface to-surface border border-accent/20">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{L('Ранг', 'Rank')}</div>
            <div className="text-2xl font-bold leading-tight">{data.rank.name}</div>
            <div className="text-xs text-muted mt-0.5">{L('Уровень', 'Level')} {data.rank.level}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent leading-none">{data.xpTotal}</div>
            <div className="text-[11px] text-muted">XP</div>
          </div>
        </div>
        <div className="mt-4 h-2.5 rounded-full bg-bg/80 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent to-positive transition-all duration-500" style={{ width: `${data.rank.progressPct}%` }} />
        </div>
        <div className="text-[11px] text-muted mt-1.5 text-right">
          {L('До уровня', 'To level')} {data.rank.level + 1}: {Math.max(0, data.rank.nextLevelXp - data.xpTotal)} XP
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-3 gap-3">
        <Stat label={i.today.streak} value={`🔥 ${data.streakCurrent}`} sub={`${i.progress.bestStreak}: ${data.streakBest}`} />
        <Stat label={L('Выполнено', 'Completed')} value={`${data.completedTasks}`} />
        <Stat label={L('Достижения', 'Badges')} value={`${earned}/${data.achievements.length}`} />
      </section>

      {/* 7-day chart */}
      <section className="surface">
        <div className="text-xs text-muted mb-3">{i.progress.last7}</div>
        <div className="flex items-end gap-2">
          {data.last7.map((d) => {
            const ratio = d.total === 0 ? 0 : d.done / d.total;
            const heightPct = Math.max(6, Math.round(ratio * 100));
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full h-28 bg-bg rounded relative">
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-accent to-positive rounded transition-all" style={{ height: `${heightPct}%`, opacity: ratio === 0 ? 0.25 : 1 }} />
                </div>
                <div className="text-[10px] text-muted">{d.date.slice(5)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Achievements */}
      <section className="space-y-3">
        <div className="text-sm font-semibold px-1">{L('Достижения', 'Achievements')}</div>
        <div className="grid grid-cols-2 gap-3">
          {data.achievements.map((a) => (
            <div key={a.code} className={`rounded-card p-3 border transition ${a.earned ? 'border-accent/40 bg-accent/10' : 'border-white/5 bg-surface/50'}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xl ${a.earned ? '' : 'grayscale opacity-40'}`}>{a.icon}</span>
                <div className="min-w-0">
                  <div className={`text-sm font-medium truncate ${a.earned ? '' : 'text-muted'}`}>{a.title}</div>
                </div>
              </div>
              <div className="text-[11px] text-muted mt-1.5">{a.description}</div>
              {!a.earned && (
                <div className="mt-2 h-1 rounded-full bg-bg overflow-hidden">
                  <div className="h-full bg-accent/60" style={{ width: `${Math.min(100, Math.round((a.current / a.target) * 100))}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Leaderboard */}
      {board && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <div className="text-sm font-semibold">{L('Таблица лидеров', 'Leaderboard')}</div>
            <div className="text-[11px] text-muted">{L('Ты', 'You')}: #{board.myRank} {L('из', 'of')} {board.totalPlayers}</div>
          </div>
          <div className="space-y-1.5">
            {board.top.map((e) => (
              <div key={e.id} className={`rounded-card px-3 py-2.5 flex items-center gap-3 border ${e.isMe ? 'border-accent/50 bg-accent/10' : 'border-white/5 bg-surface/60'}`}>
                <div className={`w-6 text-center font-bold ${e.position <= 3 ? 'text-accent' : 'text-muted'}`}>
                  {e.position === 1 ? '🥇' : e.position === 2 ? '🥈' : e.position === 3 ? '🥉' : e.position}
                </div>
                <div className="flex-1 min-w-0 truncate text-sm font-medium">{e.name}{e.isMe && <span className="text-accent text-xs"> · {L('ты', 'you')}</span>}</div>
                <div className="text-[11px] text-muted shrink-0">🔥{e.streak} · Lv{e.level}</div>
                <div className="text-sm font-semibold tabular-nums shrink-0">{e.xp}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!user.isPremium && (
        <section className="rounded-card p-4 border border-accent/30 bg-gradient-to-br from-accent/15 to-transparent text-sm">
          <div className="font-semibold text-accent">⭐ {i.today.premiumCta}</div>
          <div className="text-xs text-muted mt-1">{L('Несколько целей, план на 30 дней, перегенерация плана и больше.', 'Multiple goals, 30-day plans, plan regeneration and more.')}</div>
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
