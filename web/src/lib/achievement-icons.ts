import {
  CheckCircle2,
  Target,
  Zap,
  Wrench,
  Hammer,
  Flame,
  Mountain,
  Star,
  Sparkles,
  Handshake,
  Trophy,
  Crown,
  Award,
  type LucideIcon,
} from 'lucide-react';

// Lucide-react icon map for achievement codes. Replaces the previous emoji
// map so the gallery / showcase chips render crisp, themable SVG instead of
// platform-emoji glyphs.

const ACHIEVEMENT_ICON_MAP: Record<string, LucideIcon> = {
  first_task: CheckCircle2,
  goal_setter: Target,
  tasks_10: Zap,
  tasks_50: Wrench,
  tasks_100: Hammer,
  streak_3: Flame,
  streak_7: Flame,
  streak_30: Mountain,
  xp_500: Star,
  xp_2000: Sparkles,
  inviter: Handshake,
  secret_streak_100: Trophy,
  secret_tasks_500: Crown,
};

export function iconFor(code: string): LucideIcon {
  return ACHIEVEMENT_ICON_MAP[code] ?? Award;
}
