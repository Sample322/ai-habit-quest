import { useEffect } from 'react';
import { Flame, Mountain, Crown, type LucideIcon } from 'lucide-react';

import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';

interface Props {
  lang: Lang;
  streak: number;
  onClose: () => void;
}

const ICON: Record<number, LucideIcon> = {
  7: Flame,
  30: Mountain,
  100: Crown,
};

/**
 * Full-screen celebration shown once when the user crosses a streak
 * milestone. Self-dismisses after 5s but a tap closes early. The parent
 * decides whether to render it — see TodaySection's milestone effect.
 */
export function StreakMilestone({ lang, streak, onClose }: Props) {
  const i = t(lang);
  const title = streak === 7 ? i.milestone.title7
    : streak === 30 ? i.milestone.title30
    : i.milestone.title100;
  const IconCmp = ICON[streak] ?? Flame;

  useEffect(() => {
    haptic('heavy');
    notify('success');
    const off = setTimeout(onClose, 5000);
    return () => clearTimeout(off);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div className="relative max-w-sm w-full text-center space-y-5">
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-20 rounded-full blur-3xl opacity-60 animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, rgba(255,94,108,0.5), transparent 70%)' }}
        />
        <div className="relative animate-pop flex items-center justify-center text-warning">
          <IconCmp size={104} className="drop-shadow-[0_8px_32px_rgba(255,94,108,0.6)]" />
        </div>
        <div className="relative space-y-2">
          <div className="shimmer text-3xl font-bold tracking-tight">{title}</div>
          <div className="text-sm text-muted">{i.milestone.body}</div>
        </div>
        <div className="relative flex items-center justify-center gap-1 text-warning">
          <Flame size={14} />
          <span className="text-2xl font-bold tabular">{streak}</span>
        </div>
      </div>
    </div>
  );
}

export const MILESTONE_STREAKS = [7, 30, 100] as const;
