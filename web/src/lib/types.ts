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
  isAdmin: boolean;
  premiumUntil: string | null;
  streak: { current: number; best: number };
  xpTotal: number;
  level: number;
  referralCode: string;
  referralCount: number;
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
  goalId: string;
  goalTitle: string;
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

export interface AdminStats {
  generatedAt: string;
  users: { total: number; premium: number; new24h: number; new7d: number };
  goals: { total: number; active: number };
  plans: { total: number; openai: number; stub: number; aiHealthPct: number };
  tasks: { total: number; completed: number; completionPct: number };
  payments: { events: number; succeeded: number };
  feedback: number;
}

export interface AdminUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  languageCode: string;
  isPremium: boolean;
  premiumUntil: string | null;
  streakCurrent: number;
  xpTotal: number;
  level: number;
  createdAt: string;
}

export interface AdminFeedback {
  id: string;
  message: string;
  createdAt: string;
  user: string;
}

export interface Plan {
  provider: 'stub' | 'ollama' | 'openai';
  category: GoalCategory;
  horizonDays: number;
  habits: { title: string; description?: string }[];
  schedule: PlanDay[];
}
