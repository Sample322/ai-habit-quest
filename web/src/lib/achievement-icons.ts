// Mirror of backend progress-extras achievement icons. Used by Header
// showcase chips so we can render the user's picked badges without
// re-fetching /progress on every render.

const ACHIEVEMENT_ICONS: Record<string, string> = {
  first_task: '✅',
  goal_setter: '🎯',
  tasks_10: '⚡',
  tasks_50: '🔧',
  tasks_100: '🏗️',
  streak_3: '🔥',
  streak_7: '🔥',
  streak_30: '🌋',
  xp_500: '⭐',
  xp_2000: '💫',
  inviter: '🤝',
  secret_streak_100: '🏆',
  secret_tasks_500: '👑',
};

export function iconFor(code: string): string {
  return ACHIEVEMENT_ICONS[code] ?? '🏅';
}
