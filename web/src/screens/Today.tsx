import { useCallback, useEffect, useMemo, useState } from 'react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { DailyTask, User, BonusTask } from '../lib/types';
import { ReferralCard } from '../components/ReferralCard';

interface TodayProps {
  lang: Lang;
  user: User;
  activeGoalsCount: number;
  onUserChange: (u: User) => void;
  onPremiumClick: () => void;
  onAddGoal: () => void;
  onDeleteGoal: (goalId: string, goalTitle: string) => void;
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
  onDeleteGoal,
}: TodayProps) {
  const i = t(lang);
  const [tasks, setTasks] = useState<DailyTask[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [regenGoalId, setRegenGoalId] = useState<string | null>(null);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
  const [bonus, setBonus] = useState<BonusTask | null>(null);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const list = await api.todayTasks();
    setTasks(list);
  }, []);

  useEffect(() => {
    void load();
    // Bonus is premium-only; backend returns null otherwise. Non-fatal.
    void (async () => { try { setBonus(await api.bonusToday()); } catch { /* ignore */ } })();
  }, [load]);

  async function completeBonus(): Promise<void> {
    if (!bonus || bonus.doneAt || bonusBusy) return;
    setBonusBusy(true);
    haptic('medium');
    try {
      const { bonus: updated, xpTotal } = await api.completeBonus(bonus.id);
      setBonus(updated);
      onUserChange({ ...user, xpTotal });
      notify('success');
      showToast(`✨ +${updated.xp} XP`);
    } catch {
      notify('error');
    } finally {
      setBonusBusy(false);
    }
  }

  function showToast(msg: string): void {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function regenerate(goalId: string): Promise<void> {
    if (regenGoalId) return;
    if (!user.isPremium) { haptic('light'); onPremiumClick(); return; } // Premium-only feature → upsell
    setRegenGoalId(goalId);
    setRegenMsg(i.regen.loading);
    haptic('medium');
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 100_000);
    try {
      await api.regeneratePlan(goalId, ctrl.signal);
      await load();
      notify('success');
      setRegenMsg(i.regen.done);
    } catch (err) {
      notify('error');
      const status = (err as { status?: number }).status;
      setRegenMsg(status === 503 ? i.regen.busy : i.errors.generic);
    } finally {
      clearTimeout(timeout);
      setRegenGoalId(null);
      setTimeout(() => setRegenMsg(null), 4000);
    }
  }

  async function toggle(id: string): Promise<void> {
    setBusy(id);
    haptic('light');
    try {
      const { task, user: snap, newAchievements } = await api.toggleTask(id);
      setTasks((prev) => prev?.map((t) => (t.id === task.id ? task : t)) ?? null);
      onUserChange({
        ...user,
        xpTotal: snap.xpTotal,
        level: snap.level,
        streak: { ...user.streak, current: snap.streakCurrent },
      });
      notify(task.doneAt ? 'success' : 'warning');
      if (newAchievements && newAchievements.length > 0) {
        const a = newAchievements[0];
        showToast(`🏆 ${i.achievementUnlocked} ${a.icon} ${a.title}`);
      }
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

      {regenMsg && (
        <div className="surface text-sm flex items-center gap-3 animate-[fadeIn_240ms_ease-out]">
          {regenGoalId && (
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
          )}
          <span className={regenGoalId ? 'text-text' : 'text-muted'}>{regenMsg}</span>
        </div>
      )}

      {bonus && (
        <section className={`rounded-card p-4 border transition ${bonus.doneAt ? 'border-positive/30 bg-positive/5' : 'border-accent/40 bg-gradient-to-br from-accent/15 to-transparent'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <span className="font-semibold text-sm">{i.bonus.title}</span>
            <span className="ml-auto text-[11px] text-accent font-medium">+{bonus.xp} XP</span>
          </div>
          <div className={`text-sm mt-2 ${bonus.doneAt ? 'line-through text-muted' : ''}`}>{bonus.title}</div>
          {bonus.doneAt ? (
            <div className="text-[11px] text-positive mt-2">✓ {i.bonus.done}</div>
          ) : (
            <button
              onClick={completeBonus}
              disabled={bonusBusy}
              className="mt-3 w-full rounded-card bg-accent text-accentText font-medium py-2 text-sm transition active:opacity-80 disabled:opacity-50"
            >
              {bonusBusy ? '…' : i.bonus.claim}
            </button>
          )}
          <div className="text-[10px] text-muted mt-2">{i.bonus.hint}</div>
        </section>
      )}

      {isLoading && <SkeletonGoals />}

      {!isLoading && !hasTasks && (
        <div className="surface text-muted text-sm">{i.today.empty}</div>
      )}

      {hasTasks &&
        groups.map((group) => (
          <GoalSection
            key={group.goalId}
            lang={lang}
            group={group}
            onToggle={toggle}
            onDelete={() => onDeleteGoal(group.goalId, group.goalTitle)}
            onRegenerate={() => regenerate(group.goalId)}
            regenerating={regenGoalId === group.goalId}
            regenDisabled={regenGoalId !== null}
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

      <ReferralCard lang={lang} user={user} />

      {toast && (
        <div className="fixed bottom-24 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="bg-bg/95 border border-accent/30 rounded-card px-4 py-3 text-sm shadow-lg max-w-md w-full text-center animate-[fadeIn_240ms_ease-out]">
            {toast}
          </div>
        </div>
      )}
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
  lang,
  group,
  onToggle,
  onDelete,
  onRegenerate,
  regenerating,
  regenDisabled,
  busyId,
}: {
  lang: Lang;
  group: GoalGroup;
  onToggle: (id: string) => void;
  onDelete: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
  regenDisabled: boolean;
  busyId: string | null;
}) {
  const i = t(lang);
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <div className="text-sm font-semibold tracking-tight truncate flex-1">{group.goalTitle}</div>
        <div className="text-[11px] text-muted tabular-nums shrink-0">
          {group.done}/{group.total}
        </div>
        <button
          onClick={onRegenerate}
          disabled={regenDisabled}
          aria-label={i.regen.action}
          title={i.regen.action}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted/60 hover:text-accent hover:bg-accent/10 transition disabled:opacity-40"
        >
          {regenerating ? (
            <span className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          )}
        </button>
        <button
          onClick={onDelete}
          aria-label={i.deleteGoal.iconLabel}
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted/60 hover:text-danger hover:bg-danger/10 transition"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h8M5 3V2a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v1M3 3l.5 7a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1L9 3" />
          </svg>
        </button>
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
