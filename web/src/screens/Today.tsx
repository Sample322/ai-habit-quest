import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sparkles, Plus, Crown, RefreshCw, Trash2, LayoutDashboard, Check } from 'lucide-react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { DailyTask, User, BonusTask } from '../lib/types';
import { ReferralCard } from '../components/ReferralCard';
import { GoalInsightsModal } from '../components/GoalInsightsModal';
import { ProgressRing } from '../components/ui/ProgressRing';
import { NumberTicker } from '../components/ui/NumberTicker';

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
  const [insightsGoalId, setInsightsGoalId] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    const list = await api.todayTasks();
    setTasks(list);
  }, []);

  useEffect(() => {
    void load();
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
    if (!user.isPremium) { haptic('light'); onPremiumClick(); return; }
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
      <HeroRing lang={lang} pct={overall.pct} done={overall.done} total={overall.total} activeGoalsCount={activeGoalsCount} />

      {regenMsg && (
        <div className="surface text-sm flex items-center gap-3 animate-rise">
          {regenGoalId && (
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
          )}
          <span className={regenGoalId ? 'text-text' : 'text-muted'}>{regenMsg}</span>
        </div>
      )}

      {bonus && <BonusCard bonus={bonus} bonusBusy={bonusBusy} lang={lang} onComplete={completeBonus} />}

      {isLoading && <SkeletonGoals />}

      {!isLoading && !hasTasks && (
        <div className="surface text-muted text-sm">{i.today.empty}</div>
      )}

      {hasTasks && (
        <div className="space-y-5">
          {groups.map((group) => (
            <GoalSection
              key={group.goalId}
              lang={lang}
              group={group}
              onToggle={toggle}
              onDelete={() => onDeleteGoal(group.goalId, group.goalTitle)}
              onRegenerate={() => regenerate(group.goalId)}
              onInsights={() => setInsightsGoalId(group.goalId)}
              regenerating={regenGoalId === group.goalId}
              regenDisabled={regenGoalId !== null}
              busyId={busy}
            />
          ))}
        </div>
      )}

      {insightsGoalId && (
        <GoalInsightsModal lang={lang} goalId={insightsGoalId} onClose={() => setInsightsGoalId(null)} />
      )}

      {!user.isPremium && (
        <button onClick={onPremiumClick} className="w-full text-left card aurora p-5 transition active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-11 h-11 rounded-pill grid place-items-center bg-accentGrad shadow-glow">
              <Crown size={18} className="text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base leading-tight">{i.today.premiumCta}</div>
              <div className="text-xs text-muted mt-0.5">{i.common.tryPremium}</div>
            </div>
            <span className="text-muted">›</span>
          </div>
        </button>
      )}

      <button
        onClick={onAddGoal}
        className="w-full rounded-card border border-dashed border-hairlineStrong hover:border-accent
                   text-muted hover:text-accent py-4 px-4 text-sm font-medium transition flex items-center justify-center gap-2"
      >
        <Plus size={16} strokeWidth={2.4} />
        {i.today.addGoal}
      </button>

      <ReferralCard lang={lang} user={user} />

      {toast && (
        <div className="fixed bottom-28 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none animate-pop">
          <div className="card px-5 py-3 text-sm shadow-glow max-w-md w-full text-center font-medium">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroRing({
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
    <section className="card aurora p-5 flex items-center gap-5">
      <ProgressRing pct={pct} size={120} stroke={9}>
        <div className="hud-num text-3xl leading-none">
          <NumberTicker value={pct} />
          <span className="text-base text-muted">%</span>
        </div>
        <div className="eyebrow mt-1">{done}/{total || '·'}</div>
      </ProgressRing>
      <div className="flex-1 min-w-0">
        <div className="eyebrow text-accent">{i.today.title}</div>
        <div className="text-2xl font-bold leading-tight mt-1">
          {total === 0
            ? (lang === 'en' ? 'No tasks yet' : 'Заданий нет')
            : pct === 100
            ? (lang === 'en' ? 'All done · today wins' : 'Всё сделано · день взят')
            : (lang === 'en' ? 'Keep moving' : 'Действуй')}
        </div>
        {activeGoalsCount > 1 && (
          <div className="text-xs text-muted mt-1">
            {activeGoalsCount} {i.today.goalsActiveCount}
          </div>
        )}
      </div>
    </section>
  );
}

function BonusCard({
  bonus,
  bonusBusy,
  lang,
  onComplete,
}: {
  bonus: BonusTask;
  bonusBusy: boolean;
  lang: Lang;
  onComplete: () => void;
}) {
  const i = t(lang);
  const done = !!bonus.doneAt;
  return (
    <section
      className={`relative overflow-hidden rounded-card p-5 border transition ${
        done ? 'border-positive/30 bg-positive/[0.04]' : 'border-accentGlow/40 bg-elevated shadow-glow'
      }`}
    >
      {!done && (
        <span
          className="pointer-events-none absolute -top-16 -right-16 w-44 h-44 rounded-full blur-3xl opacity-50"
          style={{ background: 'radial-gradient(circle, #9b7dff 0%, transparent 70%)' }}
        />
      )}
      <div className="relative flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center bg-accentGrad">
          <Sparkles size={18} className="text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{i.bonus.title}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-pill bg-accentGrad text-white">
              +{bonus.xp} XP
            </span>
          </div>
          <div className={`text-sm mt-2 leading-snug ${done ? 'line-through text-muted' : 'text-text'}`}>
            {bonus.title}
          </div>
          {done ? (
            <div className="text-xs text-positive mt-2 flex items-center gap-1">
              <Check size={12} strokeWidth={3} /> {i.bonus.done}
            </div>
          ) : (
            <button
              onClick={onComplete}
              disabled={bonusBusy}
              className="btn-primary mt-4"
            >
              {bonusBusy ? '…' : i.bonus.claim}
            </button>
          )}
          <div className="text-[10px] text-muted mt-2">{i.bonus.hint}</div>
        </div>
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
  onInsights,
  regenerating,
  regenDisabled,
  busyId,
}: {
  lang: Lang;
  group: GoalGroup;
  onToggle: (id: string) => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onInsights: () => void;
  regenerating: boolean;
  regenDisabled: boolean;
  busyId: string | null;
}) {
  const i = t(lang);
  return (
    <section className="space-y-2.5">
      {/* Goal header — title + thin progress + actions */}
      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-tight truncate">{group.goalTitle}</div>
          <div className="mt-1.5 h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full bg-accentGrad rounded-full transition-all duration-700"
              style={{ width: `${group.pct}%` }}
            />
          </div>
        </div>
        <div className="text-xs text-muted tabular shrink-0 pl-2">
          {group.done}/{group.total}
        </div>
        <IconAction onClick={onInsights} label="Insights">
          <LayoutDashboard size={13} />
        </IconAction>
        <IconAction onClick={onRegenerate} disabled={regenDisabled} label={i.regen.action}>
          {regenerating ? (
            <span className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" aria-hidden />
          ) : (
            <RefreshCw size={13} />
          )}
        </IconAction>
        <IconAction onClick={onDelete} label={i.deleteGoal.iconLabel} danger>
          <Trash2 size={13} />
        </IconAction>
      </div>
      <ul className="space-y-2 stagger">
        {group.tasks.map((task) => (
          <li key={task.id}>
            <TaskRow task={task} busy={busyId === task.id} onToggle={() => onToggle(task.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TaskRow({ task, busy, onToggle }: { task: DailyTask; busy: boolean; onToggle: () => void }) {
  const done = !!task.doneAt;
  return (
    <button
      onClick={onToggle}
      disabled={busy}
      className={`relative w-full rounded-card p-3.5 pl-3 flex items-center gap-3 text-left transition border
        ${done
          ? 'bg-white/[0.015] border-hairline'
          : 'bg-surface border-hairline hover:border-hairlineStrong hover:-translate-y-[1px]'}
        active:scale-[0.99]
      `}
    >
      <span
        className={`shrink-0 w-6 h-6 rounded-pill grid place-items-center transition border-2 ${
          done ? 'bg-positive border-positive' : 'border-muted/50 hover:border-accent'
        }`}
      >
        {done && <Check size={13} strokeWidth={3.4} className="text-bg" />}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium leading-snug ${done ? 'line-through text-muted' : ''}`}>
          {task.title}
        </div>
        {done && (
          <div className="text-[11px] text-positive mt-0.5 tabular">+{task.xpAwarded || 10} XP</div>
        )}
      </div>
    </button>
  );
}

function IconAction({
  children,
  onClick,
  label,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`shrink-0 w-7 h-7 rounded-pill grid place-items-center border border-hairline text-muted transition
        disabled:opacity-40
        ${danger ? 'hover:text-danger hover:border-danger/40 hover:bg-danger/5' : 'hover:text-accent hover:border-accent/40 hover:bg-accent/5'}
      `}
    >
      {children}
    </button>
  );
}

function SkeletonGoals() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((k) => (
        <div key={k} className="surface animate-pulse">
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
