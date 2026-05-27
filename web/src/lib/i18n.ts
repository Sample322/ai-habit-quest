export type Lang = 'ru' | 'en';

const dict = {
  ru: {
    appTitle: 'AI Habit Quest',
    loading: 'Загружаем...',
    onboarding: {
      title: 'Что хочешь улучшить в ближайшие 30 дней?',
      subtitle: 'Выбери шаблон цели — мы соберём план привычек и заданий.',
      sport: 'Спорт',
      sportSub: 'Регулярная активность, движение, тонус.',
      study: 'Учёба',
      studySub: 'Сфокусированные блоки и системное повторение.',
      discipline: 'Дисциплина',
      disciplineSub: 'Подъём вовремя, главный шаг дня, цифровой перерыв.',
      custom: 'Своя цель',
      customSub: 'Сам опишу, чего хочу.',
      titleLabel: 'Название цели',
      titlePlaceholder: 'Например: бегать 3 раза в неделю',
      start: 'Поехали',
    },
    today: {
      title: 'Сегодня',
      empty: 'На сегодня заданий пока нет. Загляни попозже.',
      streak: 'Streak',
      level: 'Уровень',
      xp: 'XP',
      premiumCta: 'Открой Premium — план на 30 дней и AI-коучинг',
    },
    progress: {
      title: 'Прогресс',
      bestStreak: 'Лучший streak',
      last7: 'Последние 7 дней',
    },
    subscription: {
      title: 'Premium',
      benefit1: 'Безлимит целей и привычек',
      benefit2: 'AI-план на 30 дней',
      benefit3: 'AI-коучинг и восстановление streak',
      benefit4: 'Расширенная статистика',
      trial: 'Попробовать за 1 ₽ (3 дня)',
      monthly: '299 ₽/мес после пробного периода',
      stars: 'Оплатить через Telegram Stars',
      offer: 'Нажимая «Попробовать», я соглашаюсь с офертой и политикой конфиденциальности.',
      close: 'Позже',
    },
    nav: {
      today: 'Сегодня',
      progress: 'Прогресс',
      premium: 'Premium',
    },
    common: {
      cancel: 'Отмена',
      done: 'Готово',
      tryPremium: 'Открыть Premium',
    },
    errors: {
      auth: 'Не удалось войти в Telegram Mini App.',
      generic: 'Что-то пошло не так. Попробуй ещё раз.',
      freeGoalLimit: 'В бесплатной версии доступна одна активная цель. Открой Premium, чтобы добавить ещё.',
    },
  },
  en: {
    appTitle: 'AI Habit Quest',
    loading: 'Loading...',
    onboarding: {
      title: 'What do you want to improve in the next 30 days?',
      subtitle: 'Pick a template — we will assemble habits and daily tasks.',
      sport: 'Sport',
      sportSub: 'Regular movement and activity.',
      study: 'Study',
      studySub: 'Focused blocks and systematic review.',
      discipline: 'Discipline',
      disciplineSub: 'Wake on time, do the main step, digital wind-down.',
      custom: 'Custom goal',
      customSub: 'I will describe it myself.',
      titleLabel: 'Goal title',
      titlePlaceholder: 'e.g. Run three times a week',
      start: 'Start',
    },
    today: {
      title: 'Today',
      empty: 'No tasks for today yet. Check back later.',
      streak: 'Streak',
      level: 'Level',
      xp: 'XP',
      premiumCta: 'Unlock Premium — 30-day AI plan and coaching',
    },
    progress: {
      title: 'Progress',
      bestStreak: 'Best streak',
      last7: 'Last 7 days',
    },
    subscription: {
      title: 'Premium',
      benefit1: 'Unlimited goals and habits',
      benefit2: '30-day AI plan',
      benefit3: 'AI coaching + streak recovery',
      benefit4: 'Advanced stats',
      trial: 'Try for 1 ₽ (3 days)',
      monthly: '299 ₽/month after trial',
      stars: 'Pay with Telegram Stars',
      offer: 'By pressing Try I agree to the public offer and privacy policy.',
      close: 'Later',
    },
    nav: {
      today: 'Today',
      progress: 'Progress',
      premium: 'Premium',
    },
    common: {
      cancel: 'Cancel',
      done: 'Done',
      tryPremium: 'Unlock Premium',
    },
    errors: {
      auth: 'Could not authenticate Telegram Mini App.',
      generic: 'Something went wrong. Try again.',
      freeGoalLimit: 'Free tier allows only one active goal. Unlock Premium to add more.',
    },
  },
} as const;

type Dict = typeof dict.ru;

export function t(lang: Lang): Dict {
  return dict[lang];
}
