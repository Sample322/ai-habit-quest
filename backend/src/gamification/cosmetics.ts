// E: derived avatar frames + titles. No new tables — everything is computed
// from existing stats so badges/frames can never get out of sync.

export type FrameTier = 'none' | 'bronze' | 'silver' | 'gold' | 'aurora';

export interface CosmeticsView {
  /** Highest-tier frame the user has earned. */
  frame: FrameTier;
  /** Optional title shown next to the user's name. null when none earned. */
  title: string | null;
}

interface CosmeticsInput {
  level: number;
  isPremium: boolean;
  earnedAchievementCodes: Set<string>;
}

/**
 * Map (level, premium, badges) → best frame + title. Priorities are walked
 * top-to-bottom so the highest unlocked tier wins.
 */
export function computeCosmetics(input: CosmeticsInput, lang: 'ru' | 'en' = 'ru'): CosmeticsView {
  const has = (code: string): boolean => input.earnedAchievementCodes.has(code);

  // Frame ladder. Premium boosts each step by one tier.
  let frame: FrameTier = 'none';
  if (input.level >= 1) frame = 'bronze';
  if (input.level >= 5 || has('streak_7')) frame = 'silver';
  if (input.level >= 10 || has('tasks_100') || has('streak_30')) frame = 'gold';
  if (has('secret_streak_100') || has('secret_tasks_500')) frame = 'aurora';

  // Title selection — highest-prestige unlocked.
  const titles: { code: string; ru: string; en: string }[] = [
    { code: 'secret_streak_100', ru: 'Легенда дисциплины', en: 'Legend of Discipline' },
    { code: 'secret_tasks_500', ru: 'Король привычек', en: 'Habit King' },
    { code: 'streak_30', ru: 'Несокрушимый', en: 'Unstoppable' },
    { code: 'tasks_100', ru: 'Машина дисциплины', en: 'Discipline Machine' },
    { code: 'tasks_50', ru: 'Адепт привычек', en: 'Habit Adept' },
    { code: 'streak_7', ru: 'Неделя в ударе', en: 'A Week Strong' },
    { code: 'inviter', ru: 'Лидер круга', en: 'Circle Leader' },
  ];
  let title: string | null = null;
  for (const t of titles) {
    if (has(t.code)) {
      title = lang === 'en' ? t.en : t.ru;
      break;
    }
  }

  return { frame, title };
}
