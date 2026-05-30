import { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import type { GoalCategory } from '../lib/types';
import { haptic, notify } from '../lib/telegram';
import { GoalCreating } from '../components/GoalCreating';

// How long to show each stage before advancing, and the hard client-side
// ceiling for the whole request (a hair above the backend's 90s axios timeout).
const STAGE_INTERVAL_MS = 2200;
const CREATE_TIMEOUT_MS = 100_000;

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
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stages = i.onboarding.creating.stages;

  // Pace the visual stages while the (single) create request is in flight,
  // holding on the last stage until the server responds.
  useEffect(() => {
    if (!submitting) return;
    stageTimer.current = setInterval(() => {
      setStage((s) => Math.min(s + 1, stages.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, [submitting, stages.length]);

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
    setError(null);
    setStage(0);
    setSubmitting(true);

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), CREATE_TIMEOUT_MS);
    try {
      await api.createGoal(finalTitle, picked, ctrl.signal);
      // Mark every stage done, hold the success frame briefly, then hand off.
      setStage(stages.length);
      notify('success');
      await new Promise((r) => setTimeout(r, 500));
      await onCreated();
    } catch (err) {
      notify('error');
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      setError(aborted ? i.errors.timeout : err instanceof Error ? err.message : i.errors.generic);
      setSubmitting(false);
    } finally {
      clearTimeout(timeout);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold leading-tight">{i.onboarding.title}</h1>
        <p className="text-sm text-muted mt-2">{i.onboarding.subtitle}</p>
      </div>

      {submitting ? (
        <GoalCreating
          heading={i.onboarding.creating.heading}
          note={i.onboarding.creating.note}
          stages={stages}
          current={stage}
        />
      ) : (
        <>
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
              <button onClick={submit} className="btn-primary">
                {i.onboarding.start}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
