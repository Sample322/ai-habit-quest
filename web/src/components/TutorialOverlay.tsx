import { useState } from 'react';
import { Check, ChevronRight, X, Sparkles, Trophy, Users, Settings } from 'lucide-react';

import { haptic } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';

interface Props {
  lang: Lang;
  onClose: () => void;
}

const STORAGE_KEY = 'ahq.tutorial.v1.done';

export function shouldShowTutorial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

function markTutorialDone(): void {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
}

/**
 * Four-step first-run tour shown after the user's first goal lands on the
 * Today screen. Pure overlay (no DOM probing) so it works regardless of
 * screen layout. Persists completion in localStorage so it never repeats.
 */
export function TutorialOverlay({ lang, onClose }: Props) {
  const i = t(lang);
  const [step, setStep] = useState(0);

  const steps = [
    { Icon: Check, title: i.tutorial.step1Title, body: i.tutorial.step1Body, color: '#19d57a' },
    { Icon: Sparkles, title: i.tutorial.step2Title, body: i.tutorial.step2Body, color: '#9b7dff' },
    { Icon: Trophy, title: i.tutorial.step3Title, body: i.tutorial.step3Body, color: '#f3c969' },
    { Icon: Settings, title: i.tutorial.step4Title, body: i.tutorial.step4Body, color: '#7c5cff' },
  ];

  const cur = steps[step];
  const last = step === steps.length - 1;

  function next(): void {
    haptic('light');
    if (last) {
      markTutorialDone();
      onClose();
    } else {
      setStep(step + 1);
    }
  }

  function skip(): void {
    haptic('light');
    markTutorialDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="card aurora w-full max-w-md p-6 space-y-5 relative overflow-hidden">
        {/* Tinted halo */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl opacity-40"
          style={{ background: `radial-gradient(circle, ${cur.color} 0%, transparent 70%)` }}
        />
        <div className="relative flex items-start justify-between gap-3">
          <span
            className="shrink-0 w-12 h-12 rounded-pill grid place-items-center shadow-glow"
            style={{ background: `linear-gradient(135deg, ${cur.color}40, ${cur.color}10)`, border: `1.5px solid ${cur.color}` }}
          >
            <cur.Icon size={22} style={{ color: cur.color }} />
          </span>
          <button
            onClick={skip}
            aria-label="Skip"
            className="w-9 h-9 -mr-2 -mt-1 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative space-y-2">
          <div className="eyebrow text-accent">{step + 1} / {steps.length}</div>
          <h2 className="text-2xl font-bold tracking-tight leading-tight">{cur.title}</h2>
          <p className="text-sm text-muted leading-relaxed">{cur.body}</p>
        </div>

        {/* Step dots */}
        <div className="relative flex items-center gap-1.5">
          {steps.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === step ? 'w-8 bg-accent' : idx < step ? 'w-1.5 bg-positive' : 'w-1.5 bg-white/15'
              }`}
            />
          ))}
        </div>

        <div className="relative flex gap-2">
          {!last && (
            <button onClick={skip} className="btn-ghost flex-1">
              {i.tutorial.skip}
            </button>
          )}
          <button onClick={next} className={`btn-primary ${last ? '' : 'flex-1'} flex items-center justify-center gap-1`}>
            {last ? i.tutorial.finish : i.tutorial.next}
            {!last && <ChevronRight size={16} />}
            {last && <Users size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
