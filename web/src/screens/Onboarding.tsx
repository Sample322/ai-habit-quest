import { useEffect, useRef, useState } from 'react';

import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import type { GoalCategory } from '../lib/types';
import { haptic, notify } from '../lib/telegram';
import { GoalCreating } from '../components/GoalCreating';
import { Icon } from '../components/ui/Icons';
import { templatesFor } from '../lib/templates';

const STAGE_INTERVAL_MS = 2200;
const CREATE_TIMEOUT_MS = 100_000;

interface CategoryDef {
  id: GoalCategory;
  Icon: typeof Icon.sport;
  accentFrom: string;
  accentTo: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'sport', Icon: Icon.sport, accentFrom: '#ff5e6c', accentTo: '#ff8a3d' },
  { id: 'study', Icon: Icon.study, accentFrom: '#4f8bff', accentTo: '#7c5cff' },
  { id: 'discipline', Icon: Icon.discipline, accentFrom: '#19d57a', accentTo: '#3ecf8e' },
  { id: 'custom', Icon: Icon.custom, accentFrom: '#7c5cff', accentTo: '#d57bff' },
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

  const stages = i.creating.stages;

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
    <div className="space-y-6 stagger">
      {/* Editorial hero — eyebrow + display headline */}
      <div className="space-y-2">
        <div className="eyebrow text-accent">{i.appTitle}</div>
        <h1 className="text-3xl font-bold leading-[1.05] tracking-tight">{i.onboarding.title}</h1>
        <p className="text-sm text-muted leading-relaxed">{i.onboarding.subtitle}</p>
      </div>

      {submitting ? (
        <GoalCreating
          heading={i.creating.heading}
          note={i.creating.note}
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
              const active = picked === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => { haptic('light'); setPicked(c.id); }}
                  className={`group relative overflow-hidden rounded-card border p-4 text-left transition
                    ${active
                      ? 'border-accentGlow bg-elevated shadow-glow scale-[1.01]'
                      : 'border-hairline bg-surface hover:border-hairlineStrong hover:-translate-y-0.5'}
                  `}
                >
                  {/* Category-tinted halo */}
                  <span
                    className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-50 transition group-hover:opacity-80"
                    style={{ background: `radial-gradient(circle, ${c.accentFrom} 0%, transparent 70%)` }}
                  />
                  <span
                    className="relative inline-flex items-center justify-center w-11 h-11 rounded-pill border border-hairlineStrong"
                    style={{ background: `linear-gradient(135deg, ${c.accentFrom}33, ${c.accentTo}11)` }}
                  >
                    <c.Icon size={22} strokeWidth={2} className="text-white" />
                  </span>
                  <div className="relative font-semibold mt-3 text-[15px] leading-tight">{label}</div>
                  <div className="relative text-xs text-muted mt-1 leading-snug">{sub}</div>
                  {active && (
                    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-accent grid place-items-center">
                      <Icon.check size={12} strokeWidth={3} className="text-white" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {picked && (
            <div className="card p-5 space-y-4 animate-rise">
              {/* Goal templates — tap to autofill the title input */}
              <div>
                <div className="eyebrow flex items-center justify-between">
                  <span>{i.templates.title}</span>
                  <span className="text-muted normal-case tracking-normal font-normal">{i.templates.hint}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {templatesFor(picked).map((t) => {
                    const text = lang === 'en' ? t.en : t.ru;
                    const active = title === text;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { haptic('light'); setTitle(text); }}
                        className={`px-3 py-1.5 rounded-pill text-xs transition border flex items-center gap-1.5 ${
                          active
                            ? 'border-accent bg-accent/10 text-text shadow-glow'
                            : 'border-hairlineStrong text-muted bg-white/[0.02] hover:text-text hover:bg-white/[0.04]'
                        }`}
                      >
                        <span className="truncate max-w-[200px]">{text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="eyebrow">{i.onboarding.titleLabel} <span className="normal-case tracking-normal font-normal text-muted">· {i.templates.orCustom}</span></div>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={i.onboarding.titlePlaceholder}
                  className="mt-2 w-full appearance-none bg-elevated text-text caret-accent rounded-card px-4 py-3.5 outline-none border border-hairline focus:border-accent transition text-base placeholder:text-dim"
                  style={{ colorScheme: 'dark', WebkitTextFillColor: '#f5f7fb' }}
                />
              </div>
              {error && (
                <div className="text-xs text-danger flex items-start gap-1.5">
                  <Icon.close size={12} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <button onClick={submit} className="btn-primary">
                {i.onboarding.start}
                <Icon.chevron size={16} className="inline ml-1 -mr-1 -mt-0.5" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
