// Pure helpers for rank tiers and achievements. Achievements are DERIVED from
// the user's current stats (not stored), so they're always consistent and can
// never get out of sync — important after the "chart that didn't work" lesson.
//
// D4: rarity tiers (bronze/silver/gold/secret) + bonus XP on first earn.
// Secret achievements stay hidden ("???" + lock icon) until unlocked.

export type AchievementRarity = 'bronze' | 'silver' | 'gold' | 'secret';

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
  rarity: AchievementRarity;
  bonusXp: number;
  hidden: boolean;  // true when secret and not yet earned (UI shows "???")
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

interface AchievementDef {
  code: string;
  icon: string;
  target: number;
  metric: keyof AchievementStats;
  rarity: AchievementRarity;
  bonusXp: number;
  title: { ru: string; en: string };
  description: { ru: string; en: string };
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { code: 'first_task', icon: '✅', target: 1, metric: 'completedTasks', rarity: 'bronze', bonusXp: 20,
    title: { ru: 'Первый шаг', en: 'First step' },
    description: { ru: 'Выполни первое задание', en: 'Complete your first task' } },
  { code: 'goal_setter', icon: '🎯', target: 1, metric: 'goals', rarity: 'bronze', bonusXp: 20,
    title: { ru: 'Цель поставлена', en: 'Goal set' },
    description: { ru: 'Создай первую цель', en: 'Create your first goal' } },
  { code: 'tasks_10', icon: '⚡', target: 10, metric: 'completedTasks', rarity: 'bronze', bonusXp: 30,
    title: { ru: 'Набираю темп', en: 'Picking up pace' },
    description: { ru: 'Выполни 10 заданий', en: 'Complete 10 tasks' } },
  { code: 'tasks_50', icon: '🔧', target: 50, metric: 'completedTasks', rarity: 'silver', bonusXp: 75,
    title: { ru: 'Привычка крепнет', en: 'Habit forming' },
    description: { ru: 'Выполни 50 заданий', en: 'Complete 50 tasks' } },
  { code: 'tasks_100', icon: '🏗️', target: 100, metric: 'completedTasks', rarity: 'gold', bonusXp: 150,
    title: { ru: 'Машина дисциплины', en: 'Discipline machine' },
    description: { ru: 'Выполни 100 заданий', en: 'Complete 100 tasks' } },
  { code: 'streak_3', icon: '🔥', target: 3, metric: 'streakBest', rarity: 'bronze', bonusXp: 25,
    title: { ru: 'Разогрев', en: 'Warming up' },
    description: { ru: 'Серия 3 дня', en: '3-day streak' } },
  { code: 'streak_7', icon: '🔥', target: 7, metric: 'streakBest', rarity: 'silver', bonusXp: 70,
    title: { ru: 'Неделя в ударе', en: 'A week strong' },
    description: { ru: 'Серия 7 дней', en: '7-day streak' } },
  { code: 'streak_30', icon: '🌋', target: 30, metric: 'streakBest', rarity: 'gold', bonusXp: 200,
    title: { ru: 'Несокрушимый', en: 'Unstoppable' },
    description: { ru: 'Серия 30 дней', en: '30-day streak' } },
  { code: 'xp_500', icon: '⭐', target: 500, metric: 'xpTotal', rarity: 'silver', bonusXp: 50,
    title: { ru: 'Опытный', en: 'Seasoned' },
    description: { ru: 'Набери 500 XP', en: 'Earn 500 XP' } },
  { code: 'xp_2000', icon: '💫', target: 2000, metric: 'xpTotal', rarity: 'gold', bonusXp: 200,
    title: { ru: 'Ветеран', en: 'Veteran' },
    description: { ru: 'Набери 2000 XP', en: 'Earn 2000 XP' } },
  { code: 'inviter', icon: '🤝', target: 1, metric: 'referrals', rarity: 'silver', bonusXp: 50,
    title: { ru: 'Зову друзей', en: 'Bringing friends' },
    description: { ru: 'Пригласи друга', en: 'Invite a friend' } },
  // --- D4: secret achievements (description shown only after unlock) ---
  { code: 'secret_streak_100', icon: '🏆', target: 100, metric: 'streakBest', rarity: 'secret', bonusXp: 500,
    title: { ru: 'Легенда дисциплины', en: 'Legend of discipline' },
    description: { ru: 'Серия 100 дней — секретная награда', en: '100-day streak — secret reward' } },
  { code: 'secret_tasks_500', icon: '👑', target: 500, metric: 'completedTasks', rarity: 'secret', bonusXp: 500,
    title: { ru: 'Король привычек', en: 'Habit king' },
    description: { ru: 'Выполни 500 заданий — секрет', en: 'Complete 500 tasks — secret' } },
];

export function computeAchievements(s: AchievementStats, lang: Lang = 'ru'): AchievementView[] {
  return ACHIEVEMENT_DEFS.map((d) => {
    const current = s[d.metric];
    const earned = current >= d.target;
    const hidden = d.rarity === 'secret' && !earned;
    return {
      code: d.code,
      icon: hidden ? '🔒' : d.icon,
      title: hidden ? '???' : (lang === 'en' ? d.title.en : d.title.ru),
      description: hidden
        ? (lang === 'en' ? 'Hidden achievement' : 'Скрытое достижение')
        : (lang === 'en' ? d.description.en : d.description.ru),
      target: d.target,
      current,
      earned,
      rarity: d.rarity,
      bonusXp: d.bonusXp,
      hidden,
    };
  });
}

/** Look up the bonus XP for a given achievement code (used when granting on first earn). */
export function bonusXpFor(code: string): number {
  const def = ACHIEVEMENT_DEFS.find((d) => d.code === code);
  return def?.bonusXp ?? 0;
}
