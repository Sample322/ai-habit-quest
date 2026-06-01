import { Check, Sparkles } from 'lucide-react';

interface GoalCreatingProps {
  heading: string;
  note: string;
  stages: readonly string[];
  /** Index of the in-progress stage. Stages before it render as done. */
  current: number;
}

/**
 * Cinematic "AI is building your plan" feedback. Stages light up as the timer
 * ticks; the active row pulses with an accent glow.
 */
export function GoalCreating({ heading, note, stages, current }: GoalCreatingProps) {
  return (
    <div className="card aurora p-6 space-y-5 animate-rise">
      <div className="flex items-center gap-3">
        <span className="relative grid h-9 w-9 place-items-center rounded-pill border border-hairlineStrong bg-elevated">
          <Sparkles size={16} className="text-accentGlow" />
          <span className="absolute inset-0 rounded-pill animate-pulse-glow" />
        </span>
        <div>
          <h2 className="font-semibold text-lg leading-tight">{heading}</h2>
          <div className="eyebrow mt-1">AI · {stages.length} steps</div>
        </div>
      </div>

      <ul className="space-y-2.5">
        {stages.map((label, idx) => {
          const done = idx < current;
          const active = idx === current;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-card transition border ${
                active
                  ? 'border-accent/40 bg-accent/5'
                  : done
                  ? 'border-hairline bg-white/[0.02]'
                  : 'border-transparent opacity-40'
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-pill text-[11px] font-bold transition ${
                  done
                    ? 'bg-positive text-bg'
                    : active
                    ? 'bg-accent text-white'
                    : 'bg-white/5 text-muted'
                }`}
              >
                {done ? <Check size={13} strokeWidth={3} /> : idx + 1}
              </span>
              <span className={`text-sm font-medium ${active || done ? 'text-text' : 'text-muted'}`}>{label}</span>
              {active && (
                <span
                  className="ml-auto h-3.5 w-3.5 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted leading-relaxed">{note}</p>
    </div>
  );
}
