import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { DailyTask, Goal, User } from '../lib/types';

export function Today({
  lang,
  user,
  goal,
  onUserChange,
  onPremiumClick,
}: {
  lang: Lang;
  user: User;
  goal: Goal;
  onUserChange: (u: User) => void;
  onPremiumClick: () => void;
}) {
  const i = t(lang);
  const [tasks, setTasks] = useState<DailyTask[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const list = await api.todayTasks();
    setTasks(list);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function toggle(id: string) {
    setBusy(id);
    haptic('light');
    try {
      const { task, user: snap } = await api.toggleTask(id);
      setTasks((prev) => prev?.map((t) => (t.id === task.id ? task : t)) ?? null);
      onUserChange({ ...user, xpTotal: snap.xpTotal, level: snap.level, streak: { ...user.streak, current: snap.streakCurrent } });
      notify(task.doneAt ? 'success' : 'warning');
    } catch {
      notify('error');
    } finally {
      setBusy(null);
    }
  }

  const done = tasks?.filter((t) => t.doneAt).length ?? 0;
  const total = tasks?.length ?? 0;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-5">
      <section className="surface">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted">{i.today.title}</div>
            <div className="text-xl font-semibold mt-1">{goal.title}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent">{done}/{total || '·'}</div>
            <div className="text-xs text-muted">{pct}%</div>
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-bg overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </section>

      <section className="space-y-3">
        {tasks && tasks.length === 0 && (
          <div className="surface text-muted text-sm">{i.today.empty}</div>
        )}
        {tasks?.map((task) => (
          <button
            key={task.id}
            onClick={() => toggle(task.id)}
            disabled={busy === task.id}
            className={`w-full surface flex items-center gap-3 text-left transition ${
              task.doneAt ? 'opacity-60' : ''
            }`}
          >
            <div
              className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                task.doneAt ? 'bg-positive border-positive' : 'border-muted'
              }`}
            >
              {task.doneAt && <span className="text-bg text-xs">✓</span>}
            </div>
            <div className="flex-1">
              <div className={`font-medium ${task.doneAt ? 'line-through text-muted' : ''}`}>{task.title}</div>
              {task.doneAt && <div className="text-xs text-positive mt-1">+{task.xpAwarded || 10} XP</div>}
            </div>
          </button>
        ))}
      </section>

      {!user.isPremium && (
        <button onClick={onPremiumClick} className="surface w-full text-left border border-accent/30 hover:border-accent transition">
          <div className="font-semibold text-accent">⭐ {i.today.premiumCta}</div>
          <div className="text-xs text-muted mt-1">{i.common.tryPremium}</div>
        </button>
      )}
    </div>
  );
}
