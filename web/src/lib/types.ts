export type GoalCategory = 'sport' | 'study' | 'discipline' | 'custom';

export interface User {
  id: string;
  telegramId: string;
  firstName: string | null;
  username: string | null;
  languageCode: 'ru' | 'en';
  timezone: string;
  reminder: { hour: number; minute: number };
  isPremium: boolean;
  premiumUntil: string | null;
  streak: { current: number; best: number };
  xpTotal: number;
  level: number;
  referralCode: string;
  limits: {
    maxGoals: number | null;
    maxHabits: number | null;
    planHorizonDays: number;
  };
}

export interface Habit {
  id: string;
  goalId: string;
  title: string;
  position: number;
}

export interface Goal {
  id: string;
  title: string;
  category: GoalCategory;
  status: 'active' | 'archived';
  horizonDays: number;
  startedAt: string;
  habits: Habit[];
}

export interface DailyTask {
  id: string;
  habitId: string;
  title: string;
  doneAt: string | null;
  xpAwarded: number;
  localDate: string;
}

export interface ProgressOverview {
  streakCurrent: number;
  streakBest: number;
  xpTotal: number;
  level: number;
  last7: { date: string; total: number; done: number }[];
}

export interface PlanDay {
  day: number;
  tasks: string[];
}

export interface Plan {
  provider: 'stub' | 'ollama';
  category: GoalCategory;
  horizonDays: number;
  habits: { title: string; description?: string }[];
  schedule: PlanDay[];
}
