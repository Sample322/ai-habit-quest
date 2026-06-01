// Curated icon set — single source of truth so we can swap library without
// touching screens. Names map to product semantics, not Lucide names.
import {
  Activity,
  BookOpen,
  Brain,
  Sparkles,
  Target,
  Flame,
  Trophy,
  Crown,
  Zap,
  Snowflake,
  Share2,
  Copy,
  Check,
  X,
  Plus,
  RefreshCw,
  LayoutDashboard,
  Trash2,
  ChevronRight,
  Settings,
  Calendar,
  Award,
  Users,
  ShieldCheck,
  Lock,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const Icon = {
  // Categories — onboarding cards.
  sport: Activity,
  study: BookOpen,
  discipline: Brain,
  custom: Sparkles,

  // Gamification.
  streak: Flame,
  trophy: Trophy,
  crown: Crown,
  xp: Zap,
  freeze: Snowflake,
  rank: Award,
  league: Users,
  goal: Target,
  star: Star,
  sparkle: Sparkles,
  lock: Lock,
  shield: ShieldCheck,

  // Actions.
  share: Share2,
  copy: Copy,
  check: Check,
  close: X,
  plus: Plus,
  refresh: RefreshCw,
  insights: LayoutDashboard,
  delete: Trash2,
  chevron: ChevronRight,
  settings: Settings,
  calendar: Calendar,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof Icon;
