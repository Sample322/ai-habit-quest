import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Sparkles } from 'lucide-react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { Goal, Habit } from '../lib/types';

interface Props {
  lang: Lang;
  goal: Goal;
  onClose: () => void;
  onChanged: () => Promise<void> | void;
}

export function GoalEditModal({ lang, goal, onClose, onChanged }: Props) {
  const i = t(lang);
  const [title, setTitle] = useState(goal.title);
  const [habits, setHabits] = useState<Habit[]>(goal.habits);
  const [newHabit, setNewHabit] = useState('');
  const [busy, setBusy] = useState<'save' | 'addHabit' | string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTitle(goal.title);
    setHabits(goal.habits);
  }, [goal]);

  async function save(): Promise<void> {
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) return;
    if (cleanTitle === goal.title) {
      // Nothing to send — close.
      onClose();
      return;
    }
    setBusy('save');
    setErr(null);
    const ctrl = new AbortController();
    const tm = setTimeout(() => ctrl.abort(), 100_000);
    try {
      await api.updateGoal(goal.id, { title: cleanTitle }, ctrl.signal);
      notify('success');
      await onChanged();
      onClose();
    } catch (e) {
      notify('error');
      setErr(e instanceof Error ? e.message : i.errors.generic);
    } finally {
      clearTimeout(tm);
      setBusy(null);
    }
  }

  async function addHabit(): Promise<void> {
    const clean = newHabit.trim();
    if (clean.length < 2) return;
    setBusy('addHabit');
    setErr(null);
    try {
      const created = await api.addHabit(goal.id, clean);
      setHabits((prev) => [...prev, { id: created.id, goalId: goal.id, title: created.title, position: created.position }]);
      setNewHabit('');
      notify('success');
      await onChanged();
    } catch (e) {
      notify('error');
      setErr(e instanceof Error ? e.message : i.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  async function removeHabit(habitId: string): Promise<void> {
    setBusy(habitId);
    setErr(null);
    try {
      await api.removeHabit(habitId);
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
      haptic('medium');
      await onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : i.errors.generic);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-card border border-hairline shadow-card w-full max-w-md p-5 space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">{i.goalEdit.title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-2 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <section className="card p-4 space-y-3">
          <div className="eyebrow flex items-center gap-1">
            <Sparkles size={11} className="text-accent" />
            {i.goalEdit.titleLabel}
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={goal.title}
            className="w-full appearance-none bg-elevated text-text caret-accent rounded-card px-4 py-3 outline-none border border-hairline focus:border-accent transition text-base placeholder:text-dim"
            style={{ colorScheme: 'dark', WebkitTextFillColor: '#f5f7fb' }}
          />
          <div className="text-[11px] text-muted leading-snug">{i.goalEdit.hint}</div>
          <button onClick={save} disabled={busy !== null} className="btn-primary">
            {busy === 'save' ? i.goalEdit.saving : i.goalEdit.save}
          </button>
        </section>

        <section className="card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold leading-tight">{i.goalEdit.habitsLabel}</div>
              <div className="text-[11px] text-muted mt-0.5">{i.goalEdit.habitsHint}</div>
            </div>
            <div className="text-[10px] text-muted tabular">{habits.length}</div>
          </div>

          <div className="space-y-1.5">
            {habits.length === 0 && (
              <div className="text-xs text-muted text-center py-2">{i.goalEdit.empty}</div>
            )}
            {habits.map((h) => (
              <div key={h.id} className="rounded-card border border-hairline bg-bg/40 px-3 py-2.5 flex items-center gap-2">
                <span className="flex-1 text-sm">{h.title}</span>
                <button
                  onClick={() => removeHabit(h.id)}
                  disabled={busy === h.id}
                  aria-label="Remove"
                  className="w-7 h-7 grid place-items-center rounded-pill text-muted hover:text-danger hover:bg-danger/10 transition disabled:opacity-40"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 min-w-0">
            <input
              value={newHabit}
              onChange={(e) => setNewHabit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void addHabit(); }}
              placeholder={i.goalEdit.habitPlaceholder}
              className="min-w-0 flex-1 appearance-none bg-elevated text-text caret-accent rounded-card px-3 py-2.5 outline-none border border-hairline focus:border-accent transition text-sm placeholder:text-dim"
              style={{ colorScheme: 'dark', WebkitTextFillColor: '#f5f7fb' }}
            />
            <button
              onClick={addHabit}
              disabled={busy === 'addHabit' || newHabit.trim().length < 2}
              aria-label={i.goalEdit.addHabit}
              title={i.goalEdit.addHabit}
              className="shrink-0 w-11 h-11 rounded-card bg-accentGrad text-white shadow-glow transition active:scale-95 disabled:opacity-40 grid place-items-center"
            >
              <Plus size={18} />
            </button>
          </div>
        </section>

        {err && <div className="text-xs text-danger break-words">{err}</div>}
      </div>
    </div>
  );
}
