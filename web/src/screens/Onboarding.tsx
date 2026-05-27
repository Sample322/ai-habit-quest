import { useState } from 'react';

import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import type { GoalCategory } from '../lib/types';
import { haptic, notify } from '../lib/telegram';

const CATEGORIES: { id: GoalCategory; icon: string }[] = [
  { id: 'sport', icon: '🏃' },
  { id: 'study', icon: '📚' },
  { id: 'discipline', icon: '⏰' },
  { id: 'custom', icon: '✨' },
];

export function Onboarding({
  lang,
  onCreated,
}: {
  lang: Lang;
  onCreated: () => Promise<void> | void;
}) {
  const i = t(lang);
  const [picked, setPicked] = useState<GoalCategory | null>(null);
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultTitle = (cat: GoalCategory): string => {
    switch (cat) {
      case 'sport': return i.onboarding.sport;
      case 'study': return i.onboarding.study;
      case 'discipline': return i.onboarding.discipline;
      case 'custom': return '';
    }
  };

  async function submit() {
    if (!picked) return;
    const finalTitle = (title || defaultTitle(picked)).trim();
    if (!finalTitle) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createGoal(finalTitle, picked);
      notify('success');
      await onCreated();
    } catch (err) {
      notify('error');
      setError(err instanceof Error ? err.message : i.errors.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold leading-tight">{i.onboarding.title}</h1>
        <p className="text-sm text-muted mt-2">{i.onboarding.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map((c) => {
          const labelKey = c.id;
          const label = (i.onboarding as Record<string, string>)[labelKey];
          const sub = (i.onboarding as Record<string, string>)[`${labelKey}Sub`];
          return (
            <button
              key={c.id}
              onClick={() => { haptic('light'); setPicked(c.id); }}
              className={`surface text-left transition border ${
                picked === c.id ? 'border-accent' : 'border-transparent'
              }`}
            >
              <div className="text-2xl">{c.icon}</div>
              <div className="font-semibold mt-2">{label}</div>
              <div className="text-xs text-muted mt-1">{sub}</div>
            </button>
          );
        })}
      </div>

      {picked && (
        <div className="surface space-y-3">
          <label className="text-sm text-muted block">{i.onboarding.titleLabel}</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={i.onboarding.titlePlaceholder}
            className="w-full bg-bg rounded-card px-4 py-3 outline-none border border-white/5 focus:border-accent"
          />
          {error && <div className="text-xs text-danger">{error}</div>}
          <button
            disabled={submitting}
            onClick={submit}
            className="btn-primary"
          >
            {submitting ? '...' : i.onboarding.start}
          </button>
        </div>
      )}
    </div>
  );
}
