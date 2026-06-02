import { useRef, useState } from 'react';
import { Check, ChevronRight, ChevronLeft, X, Sparkles, Trophy, Settings as SettingsIcon, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

interface Step {
  Icon: LucideIcon;
  color: string;
  eyebrow: string;
  title: string;
  body: string;
  bullets: string[];
}

/**
 * Four-step first-run tour shown after the user's first goal lands on the
 * Today screen. Crossfade slide animation between steps + curated copy with
 * scannable bullet lists. localStorage flag keeps it strictly one-time.
 */
export function TutorialOverlay({ lang, onClose }: Props) {
  const i = t(lang);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'back'>('next');
  // Bump on every step change so the animated key is unique even if user
  // toggles back-and-forth quickly.
  const nonce = useRef(0);

  const steps: Step[] = [
    {
      Icon: Check,
      color: '#19d57a',
      eyebrow: i.tutorial.step1Eyebrow,
      title: i.tutorial.step1Title,
      body: i.tutorial.step1Body,
      bullets: [i.tutorial.step1B1, i.tutorial.step1B2, i.tutorial.step1B3],
    },
    {
      Icon: Sparkles,
      color: '#9b7dff',
      eyebrow: i.tutorial.step2Eyebrow,
      title: i.tutorial.step2Title,
      body: i.tutorial.step2Body,
      bullets: [i.tutorial.step2B1, i.tutorial.step2B2, i.tutorial.step2B3],
    },
    {
      Icon: Trophy,
      color: '#f3c969',
      eyebrow: i.tutorial.step3Eyebrow,
      title: i.tutorial.step3Title,
      body: i.tutorial.step3Body,
      bullets: [i.tutorial.step3B1, i.tutorial.step3B2, i.tutorial.step3B3],
    },
    {
      Icon: SettingsIcon,
      color: '#7c5cff',
      eyebrow: i.tutorial.step4Eyebrow,
      title: i.tutorial.step4Title,
      body: i.tutorial.step4Body,
      bullets: [i.tutorial.step4B1, i.tutorial.step4B2, i.tutorial.step4B3],
    },
  ];

  const cur = steps[step];
  const last = step === steps.length - 1;
  const first = step === 0;

  function go(dir: 'next' | 'back'): void {
    haptic('light');
    nonce.current++;
    setDirection(dir);
    if (dir === 'next') {
      if (last) {
        markTutorialDone();
        onClose();
      } else {
        setStep(step + 1);
      }
    } else if (!first) {
      setStep(step - 1);
    }
  }

  function skip(): void {
    haptic('light');
    markTutorialDone();
    onClose();
  }

  // Same key shape ensures React remounts content node + re-runs animation.
  const animClass = direction === 'next' ? 'animate-slide-right' : 'animate-slide-left';
  const contentKey = `${step}-${nonce.current}`;

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fade-in">
      <div className="card aurora w-full max-w-md p-6 space-y-5 relative overflow-hidden">
        {/* Per-step tinted halo (smooth color transition between steps) */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-50 transition-all duration-500"
          style={{ background: `radial-gradient(circle, ${cur.color} 0%, transparent 70%)` }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 w-72 h-72 rounded-full blur-3xl opacity-30 transition-all duration-500"
          style={{ background: `radial-gradient(circle, ${cur.color} 0%, transparent 70%)` }}
        />

        <div className="relative flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.25em] font-semibold text-muted tabular">
            <span style={{ color: cur.color }}>{step + 1}</span>
            <span className="text-dim"> / {steps.length}</span>
          </div>
          <button
            onClick={skip}
            aria-label="Skip"
            className="w-9 h-9 -mr-2 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Animated content slot — remounts on step change, slides in from
            chosen direction. */}
        <div key={contentKey} className={`relative ${animClass} space-y-4 min-h-[260px]`}>
          <div className="flex items-center gap-3">
            <span
              className="shrink-0 w-12 h-12 rounded-pill grid place-items-center shadow-glow transition-all"
              style={{
                background: `linear-gradient(135deg, ${cur.color}40, ${cur.color}10)`,
                border: `1.5px solid ${cur.color}`,
                boxShadow: `0 0 20px -2px ${cur.color}80`,
              }}
            >
              <cur.Icon size={22} style={{ color: cur.color }} />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: cur.color }}>
                {cur.eyebrow}
              </div>
              <h2 className="text-2xl font-bold tracking-tight leading-tight mt-0.5">{cur.title}</h2>
            </div>
          </div>

          <p className="text-sm text-text/80 leading-relaxed">{cur.body}</p>

          <ul className="space-y-2">
            {cur.bullets.map((b, idx) => (
              <li
                key={`${step}-${idx}`}
                className="flex items-start gap-2.5 text-sm leading-snug"
                style={{ animation: `slideFromRight 360ms cubic-bezier(0.16,1,0.3,1) both`, animationDelay: `${120 + idx * 80}ms` }}
              >
                <span
                  className="shrink-0 mt-0.5 w-5 h-5 rounded-pill grid place-items-center"
                  style={{ background: `${cur.color}22`, color: cur.color }}
                >
                  <Zap size={11} strokeWidth={2.6} />
                </span>
                <span className="text-text/90">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Step dots — progress indicator */}
        <div className="relative flex items-center justify-center gap-1.5 pt-1">
          {steps.map((s, idx) => (
            <span
              key={idx}
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: idx === step ? '28px' : '6px',
                background: idx === step ? s.color : idx < step ? '#19d57a' : 'rgba(255,255,255,0.12)',
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="relative flex gap-2">
          {!first && (
            <button
              onClick={() => go('back')}
              className="btn-ghost flex items-center justify-center gap-1 px-4"
              aria-label={i.tutorial.back}
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <button
            onClick={() => go('next')}
            className="btn-primary flex-1 flex items-center justify-center gap-1"
          >
            {last ? i.tutorial.finish : i.tutorial.next}
            {!last && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
