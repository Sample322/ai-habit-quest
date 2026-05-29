import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { DailyTask, User } from '../lib/types';

interface TodayProps {
  lang: Lang;
  user: User;
  activeGoalsCount: number;
  onUserChange: (u: User) => void;
  onPremiumClick: () => void;
  onAddGoal: () => void;
}

interface GoalGroup {
  goalId: string;
  goalTitle: string;
  tasks: DailyTask[];
  done: number;
  total: number;
  pct: number;
}

export function Today({
  lang,
  user,
  activeGoalsCount,
  onUserChange,
  onPremiumClick,
  onAddGoal,
}: TodayProps) {
  const i = t(lang);
  const [tasks, setTasks] = useState<DailyTask[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const list = await api.todayTasks();
    setTasks(list);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(id: string): Promise<void> {
    setBusy(id);
    haptic('light');
    try {
      const { task, user: snap } = await api.toggleTask(id);
      setTasks((prev) => prev?.map((t) => (t.id === task.id ? task : t)) ?? null);
      onUserChange({
        ...user,
        xpTotal: snap.xpTotal,
        level: snap.level,
        streak: { ...user.streak, current: snap.streakCurrent },
      });
      notify(task.doneAt ? 'success' : 'warning');
    } catch {
      notify('error');
    } finally {
      setBusy(null);
    }
  }

  const groups: GoalGroup[] = useMemo(() => groupByGoal(tasks ?? []), [tasks]);
  const overall = useMemo(() => computeOverall(groups), [groups]);

  const hasTasks = tasks !== null && tasks.length > 0;
  const isLoading = tasks === null;

  return (
    <div className="space-y-5">
      <HeaderCard lang={lang} pct={overall.pct} done={overall.done} total={overall.total} activeGoalsCount={activeGoalsCount} />

      {isLoading && <SkeletonGoals />}

      {!isLoading && !hasTasks && (
        <div className="surface text-muted text-sm">{i.today.empty}</div>
      )}

      {hasTasks &&
        groups.map((group) => (
          <GoalSection
            key={group.goalId}
            group={group}
            onToggle={toggle}
            busyId={busy}
          />
        ))}

      {!user.isPremium && (
        <button
          onClick={onPremiumClick}
          className="w-full rounded-card p-4 text-left transition active:opacity-80
                     bg-gradient-to-br from-accent/20 via-accent/10 to-transparent
                     border border-accent/30 hover:border-accent"
        >
          <div className="font-semibold text-accent flex items-center gap-2">
            <span>⭐</span>
            <span>{i.today.premiumCta}</span>
          </div>
          <div className="text-xs text-muted mt-1">{i.common.tryPremium}</div>
        </button>
      )}

      <button
        onClick={onAddGoal}
        className="w-full rounded-card border border-dashed border-white/15 hover:border-accent
                   text-muted hover:text-accent py-3 px-4 text-sm font-medium transition"
      >
        + {i.today.addGoal}
      </button>
    </div>
  );
}

function HeaderCard({
  lang,
  pct,
  done,
  total,
  activeGoalsCount,
}: {
  lang: Lang;
  pct: number;
  done: number;
  total: number;
  activeGoalsCount: number;
}) {
  const i = t(lang);
  return (
    <section className="rounded-card p-5 bg-gradient-to-br from-surface to-surface/60 border border-white/5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)]">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{i.today.title}</div>
          <div className="text-[28px] leading-none font-bold tracking-tight">
            {done}<span className="text-muted text-xl">/{total || '·'}</span>
          </div>
          {activeGoalsCount > 1 && (
            <div className="text-[11px] text-muted">
              {activeGoalsCount} {i.today.goalsActiveCount}
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-accent leading-none">{pct}<span className="text-base text-muted">%</span></div>
        </div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-bg/80 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-accent to-positive transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}

function GoalSection({
  group,
  onToggle,
  busyId,
}: {
  group: GoalGroup;
  onToggle: (id: string) => void;
  busyId: string | null;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <div className="text-sm font-semibold tracking-tight truncate">{group.goalTitle}</div>
        <div className="text-[11px] text-muted tabular-nums shrink-0 ml-2">
          {group.done}/{group.total}
        </div>
      </div>
      <ul className="space-y-2">
        {group.tasks.map((task) => (
          <li key={task.id}>
            <button
              onClick={() => onToggle(task.id)}
              disabled={busyId === task.id}
              className={`w-full rounded-card p-4 flex items-center gap-3 text-left transition active:scale-[0.99] ${
                task.doneAt
                  ? 'bg-surface/50 border border-white/5'
                  : 'bg-surface border border-white/10 hover:border-accent/40'
              }`}
            >
              <div
                className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition ${
                  task.doneAt
                    ? 'bg-positive border-2 border-positive'
                    : 'border-2 border-muted hover:border-accent'
                }`}
              >
                {task.doneAt && <span className="text-bg text-xs font-bold">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`font-medium leading-snug ${task.doneAt ? 'line-through text-muted' : ''}`}>
                  {task.title}
                </div>
                {task.doneAt && (
                  <div className="text-[11px] text-positive mt-1">+{task.xpAwarded || 10} XP</div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SkeletonGoals() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((k) => (
        <div key={k} className="rounded-card p-4 bg-surface/50 border border-white/5 animate-pulse">
          <div className="h-3 w-32 bg-white/10 rounded mb-3" />
          <div className="h-4 w-full bg-white/10 rounded" />
        </div>
      ))}
    </div>
  );
}

function groupByGoal(tasks: DailyTask[]): GoalGroup[] {
  const map = new Map<string, GoalGroup>();
  for (const task of tasks) {
    const existing = map.get(task.goalId);
    if (existing) {
      existing.tasks.push(task);
      existing.total++;
      if (task.doneAt) existing.done++;
    } else {
      map.set(task.goalId, {
        goalId: task.goalId,
        goalTitle: task.goalTitle,
        tasks: [task],
        total: 1,
        done: task.doneAt ? 1 : 0,
        pct: 0,
      });
    }
  }
  for (const group of map.values()) {
    group.pct = group.total === 0 ? 0 : Math.round((group.done / group.total) * 100);
  }
  return Array.from(map.values());
}

function computeOverall(groups: GoalGroup[]): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const g of groups) {
    done += g.done;
    total += g.total;
  }
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}
