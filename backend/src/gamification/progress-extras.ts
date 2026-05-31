// Pure helpers for rank tiers and achievements. Achievements are DERIVED from
// the user's current stats (not stored), so they're always consistent and can
// never get out of sync — important after the "chart that didn't work" lesson.

export interface RankInfo {
  level: number;
  name: string;
  currentXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  progressPct: number;
}

export interface AchievementView {
  code: string;
  icon: string;
  title: string;
  description: string;
  target: number;
  current: number;
  earned: boolean;
}

export interface AchievementStats {
  xpTotal: number;
  streakBest: number;
  completedTasks: number;
  goals: number;
  referrals: number;
}

type Lang = 'ru' | 'en';

/** XP required to reach a given level. level = floor(sqrt(xp/50)) ⇒ xp = 50·level². */
export function xpForLevel(level: number): number {
  return 50 * level * level;
}

export function computeRank(xp: number, lang: Lang = 'ru'): RankInfo {
  const level = xp <= 0 ? 0 : Math.floor(Math.sqrt(xp / 50));
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const span = nextLevelXp - levelStartXp;
  const progressPct = span > 0 ? Math.min(100, Math.max(0, Math.round(((xp - levelStartXp) / span) * 100))) : 100;
  return { level, name: rankName(level, lang), currentXp: xp, levelStartXp, nextLevelXp, progressPct };
}

function rankName(level: number, lang: Lang): string {
  const tiers: { min: number; ru: string; en: string }[] = [
    { min: 0, ru: 'Новичок', en: 'Novice' },
    { min: 1, ru: 'Ученик', en: 'Apprentice' },
    { min: 3, ru: 'Практик', en: 'Practitioner' },
    { min: 5, ru: 'Мастер', en: 'Master' },
    { min: 8, ru: 'Чемпион', en: 'Champion' },
    { min: 12, ru: 'Легенда', en: 'Legend' },
  ];
  let chosen = tiers[0];
  for (const t of tiers) if (level >= t.min) chosen = t;
  return lang === 'en' ? chosen.en : chosen.ru;
}

export function computeAchievements(s: AchievementStats, lang: Lang = 'ru'): AchievementView[] {
  const ru = lang === 'ru';
  const defs: Omit<AchievementView, 'earned'>[] = [
    { code: 'first_task', icon: '✅', target: 1, current: s.completedTasks, title: ru ? 'Первый шаг' : 'First step', description: ru ? 'Выполни первое задание' : 'Complete your first task' },
    { code: 'goal_setter', icon: '🎯', target: 1, current: s.goals, title: ru ? 'Цель поставлена' : 'Goal set', description: ru ? 'Создай первую цель' : 'Create your first goal' },
    { code: 'tasks_10', icon: '⚡', target: 10, current: s.completedTasks, title: ru ? 'Набираю темп' : 'Picking up pace', description: ru ? 'Выполни 10 заданий' : 'Complete 10 tasks' },
    { code: 'tasks_50', icon: '🔧', target: 50, current: s.completedTasks, title: ru ? 'Привычка крепнет' : 'Habit forming', description: ru ? 'Выполни 50 заданий' : 'Complete 50 tasks' },
    { code: 'tasks_100', icon: '🏗️', target: 100, current: s.completedTasks, title: ru ? 'Машина дисциплины' : 'Discipline machine', description: ru ? 'Выполни 100 заданий' : 'Complete 100 tasks' },
    { code: 'streak_3', icon: '🔥', target: 3, current: s.streakBest, title: ru ? 'Разогрев' : 'Warming up', description: ru ? 'Серия 3 дня' : '3-day streak' },
    { code: 'streak_7', icon: '🔥', target: 7, current: s.streakBest, title: ru ? 'Неделя в ударе' : 'A week strong', description: ru ? 'Серия 7 дней' : '7-day streak' },
    { code: 'streak_30', icon: '🌋', target: 30, current: s.streakBest, title: ru ? 'Несокрушимый' : 'Unstoppable', description: ru ? 'Серия 30 дней' : '30-day streak' },
    { code: 'xp_500', icon: '⭐', target: 500, current: s.xpTotal, title: ru ? 'Опытный' : 'Seasoned', description: ru ? 'Набери 500 XP' : 'Earn 500 XP' },
    { code: 'xp_2000', icon: '💫', target: 2000, current: s.xpTotal, title: ru ? 'Ветеран' : 'Veteran', description: ru ? 'Набери 2000 XP' : 'Earn 2000 XP' },
    { code: 'inviter', icon: '🤝', target: 1, current: s.referrals, title: ru ? 'Зову друзей' : 'Bringing friends', description: ru ? 'Пригласи друга' : 'Invite a friend' },
  ];
  return defs.map((d) => ({ ...d, earned: d.current >= d.target }));
}
