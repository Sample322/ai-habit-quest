interface GoalCreatingProps {
  heading: string;
  note: string;
  stages: string[];
  /** Index of the in-progress stage. Stages before it render as done. */
  current: number;
}

/**
 * Staged "we're building your plan" feedback shown while the goal + AI plan are
 * generated. The backend call is a single request, so the stages are paced on a
 * timer by the caller — the work is real, the staging just makes the wait legible
 * instead of a frozen spinner.
 */
export function GoalCreating({ heading, note, stages, current }: GoalCreatingProps) {
  return (
    <div className="surface space-y-4 animate-[fadeIn_240ms_ease-out]">
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin"
          aria-hidden
        />
        <h2 className="font-semibold">{heading}</h2>
      </div>

      <ul className="space-y-3">
        {stages.map((label, idx) => {
          const done = idx < current;
          const active = idx === current;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 transition-opacity duration-300 ${
                active ? 'opacity-100' : done ? 'opacity-80' : 'opacity-35'
              }`}
            >
              <span
                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm ${
                  done
                    ? 'bg-accent/15 text-accent'
                    : active
                      ? 'bg-accent/10 text-accent'
                      : 'bg-white/5 text-muted'
                }`}
              >
                {done ? '✓' : idx + 1}
              </span>
              <span className={`text-sm ${active ? 'text-text' : 'text-muted'}`}>{label}</span>
              {active && (
                <span
                  className="ml-auto h-4 w-4 shrink-0 rounded-full border-2 border-accent border-t-transparent animate-spin"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted">{note}</p>
    </div>
  );
}
