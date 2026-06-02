export type GoalCategory = 'sport' | 'study' | 'discipline' | 'custom';

export type FrameTier = 'none' | 'bronze' | 'silver' | 'gold' | 'aurora';

export interface Cosmetics {
  frame: FrameTier;
  title: string | null;
}

export interface User {
  id: string;
  telegramId: string;
  firstName: string | null;
  username: string | null;
  languageCode: 'ru' | 'en';
  timezone: string;
  reminder: { hour: number; minute: number };
  notifications: {
    reminders: boolean;
    achievements: boolean;
    seasons: boolean;
    streakBreak: boolean;
    weeklyRecap: boolean;
  };
  isPremium: boolean;
  isAdmin: boolean;
  premiumUntil: string | null;
  streak: { current: number; best: number; freezesLeft: number };
  xpTotal: number;
  level: number;
  referralCode: string;
  referralCount: number;
  cosmetics: Cosmetics;
  limits: {
    maxGoals: number | null;
    maxHabits: number | null;
    planHorizonDays: number;
  };
}

export interface SeasonView {
  number: number;
  startDate: string;
  endDate: string;
  daysLeft: number;
  myXp: number;
  myRank: number;
  totalPlayers: number;
  top: { position: number; id: string; name: string; xp: number; isMe: boolean }[];
  rewardTiers: { maxRank: number; days: number }[];
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

export interface RankInfo {
  level: number;
  name: string;
  currentXp: number;
  levelStartXp: number;
  nextLevelXp: number;
  progressPct: number;
}

export type AchievementRarity = 'bronze' | 'silver' | 'gold' | 'secret';

export interface Achievement {
  code: string;
  icon: string;
  title: string;
  description: string;
  target: number;
  current: number;
  earned: boolean;
  rarity: AchievementRarity;
  bonusXp: number;
  hidden: boolean;
}

export interface ProgressOverview {
  streakCurrent: number;
  streakBest: number;
  xpTotal: number;
  level: number;
  completedTasks: number;
  rank: RankInfo;
  achievements: Achievement[];
  last7: { date: string; total: number; done: number }[];
}

export interface LeaderboardEntry {
  position: number;
  id: string;
  name: string;
  xp: number;
  level: number;
  streak: number;
  isMe: boolean;
}

export type LeaderboardScope = 'global' | 'friends';

export interface Leaderboard {
  scope: LeaderboardScope;
  myRank: number;
  totalPlayers: number;
  top: LeaderboardEntry[];
}

export interface PlanDay {
  day: number;
  tasks: string[];
}

export interface LeaguesMe {
  league: {
    id: string;
    tier: number;
    tierName: string;
    tierIcon: string;
    weekStart: string;
    weekEnd: string;
    daysLeft: number;
  };
  myRank: number;
  myWeeklyXp: number;
  members: {
    position: number;
    id: string;
    name: string;
    weeklyXp: number;
    streak: number;
    level: number;
    isMe: boolean;
  }[];
  promoteCount: number;
  demoteCount: number;
}

export interface GoalInsights {
  goalId: string;
  goalTitle: string;
  horizonDays: number;
  dayIndex: number;
  daysSinceStart: number;
  completedAllTime: number;
  totalAllTime: number;
  completionPct: number;
  heatmap: { date: string; total: number; done: number }[];
}

export interface BonusTask {
  id: string;
  title: string;
  xp: number;
  doneAt: string | null;
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

export interface AdminEvent {
  id: string;
  kind: 'signup' | 'goal' | 'payment' | 'feedback';
  at: string;
  who: string;
  label: string;
  meta?: string;
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
