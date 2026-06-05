import type { GoalCategory } from './types';

export interface GoalTemplate {
  id: string;
  category: GoalCategory;
  emoji: string;
  ru: string;
  en: string;
}

// Curated preset goals that auto-fill the title field. Designed to reduce the
// "blank canvas" friction and steer users toward concrete, measurable goals
// (the AI plan generator behaves best when the title is specific).
const TEMPLATES: GoalTemplate[] = [
  // Sport
  { id: 'run3w', category: 'sport', emoji: '🏃', ru: 'Бегать 3 раза в неделю по 20 минут', en: 'Run 3 times a week for 20 minutes' },
  { id: 'push100', category: 'sport', emoji: '💪', ru: '100 отжиманий в день', en: '100 pushups per day' },
  { id: 'steps10k', category: 'sport', emoji: '👟', ru: '10 000 шагов каждый день', en: '10,000 steps every day' },
  { id: 'yoga15', category: 'sport', emoji: '🧘', ru: 'Йога 15 минут утром', en: 'Yoga 15 min in the morning' },
  { id: 'gym3w', category: 'sport', emoji: '🏋️', ru: 'Зал 3 раза в неделю', en: 'Gym 3 times a week' },
  // Study
  { id: 'eng30', category: 'study', emoji: '🇬🇧', ru: 'Учить английский 30 мин в день', en: 'Study English 30 min/day' },
  { id: 'read20p', category: 'study', emoji: '📚', ru: 'Читать 20 страниц в день', en: 'Read 20 pages/day' },
  { id: 'py30d', category: 'study', emoji: '🐍', ru: '30 дней Python — по часу в день', en: '30 days of Python — 1h/day' },
  { id: 'course', category: 'study', emoji: '🎓', ru: 'Закончить онлайн-курс к концу месяца', en: 'Finish an online course this month' },
  // Discipline
  { id: 'wake7', category: 'discipline', emoji: '🌅', ru: 'Подъём в 7:00 каждый день', en: 'Wake up at 7:00 every day' },
  { id: 'coldshower', category: 'discipline', emoji: '🧊', ru: 'Холодный душ каждое утро', en: 'Cold shower every morning' },
  { id: 'nosugar', category: 'discipline', emoji: '🚫', ru: 'Без сахара 30 дней', en: 'No sugar for 30 days' },
  { id: 'meditate10', category: 'discipline', emoji: '🕯️', ru: 'Медитация 10 минут в день', en: 'Meditate 10 min/day' },
  { id: 'nophone1h', category: 'discipline', emoji: '📵', ru: 'Час без телефона перед сном', en: 'One hour off phone before bed' },
  // Custom
  { id: 'water', category: 'custom', emoji: '💧', ru: '2 литра воды в день', en: '2 litres of water per day' },
  { id: 'gratitude', category: 'custom', emoji: '🙏', ru: 'Три благодарности в день', en: 'Three gratitudes per day' },
];

export function templatesFor(category: GoalCategory): GoalTemplate[] {
  return TEMPLATES.filter((t) => t.category === category);
}
