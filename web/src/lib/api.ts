import type {
  DailyTask, Goal, Plan, ProgressOverview, User, GoalCategory,
  AdminStats, AdminUser, AdminFeedback, AdminEvent,
  Leaderboard, LeaderboardScope, Achievement, BonusTask,
  GoalInsights, LeaguesMe, SeasonView,
} from './types';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

let token: string | null = null;

export function setToken(t: string | null): void {
  token = t;
  if (t) localStorage.setItem('ahq.token', t);
  else localStorage.removeItem('ahq.token');
}

export function loadToken(): string | null {
  if (token) return token;
  token = localStorage.getItem('ahq.token');
  return token;
}

class ApiError extends Error {
  constructor(public readonly status: number, public readonly body: unknown, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  headers.set('Content-Type', 'application/json');
  const t = loadToken();
  if (t) headers.set('Authorization', `Bearer ${t}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    const msg = typeof body === 'object' && body !== null && 'message' in body
      ? String((body as { message: unknown }).message)
      : res.statusText;
    throw new ApiError(res.status, body, msg);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

export const api = {
  loginWithInitData: (initData: string) =>
    request<{ token: string; user: { id: string; languageCode: 'ru' | 'en'; isPremium: boolean } }>(
      '/auth/telegram',
      { method: 'POST', body: JSON.stringify({ initData }) },
    ),

  me: () => request<User>('/me'),

  updatePrefs: (prefs: Partial<{
    languageCode: string;
    timezone: string;
    firstName: string;
    reminderHour: number;
    reminderMinute: number;
    notifReminders: boolean;
    notifAchievements: boolean;
    notifSeasons: boolean;
    notifStreakBreak: boolean;
    notifWeeklyRecap: boolean;
    showcaseAchievements: string[];
    aiCoachingStyle: 'gentle' | 'strict' | 'humor' | null;
  }>) =>
    request<User>('/me/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),

  goals: () => request<Goal[]>('/goals'),

  createGoal: (title: string, category: GoalCategory, signal?: AbortSignal) =>
    request<Goal>('/goals', { method: 'POST', body: JSON.stringify({ title, category }), signal }),

  goal: (id: string) => request<Goal & { plan: { payload: Plan } | null }>(`/goals/${id}`),

  regeneratePlan: (goalId: string, signal?: AbortSignal) =>
    request<Goal>(`/goals/${goalId}/regenerate-plan`, { method: 'POST', signal }),

  updateGoal: (goalId: string, patch: { title?: string; category?: GoalCategory }, signal?: AbortSignal) =>
    request<Goal>(`/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify(patch), signal }),

  addHabit: (goalId: string, title: string) =>
    request<{ id: string; title: string; position: number; goalId: string }>(
      `/goals/${goalId}/habits`,
      { method: 'POST', body: JSON.stringify({ title }) },
    ),

  updateHabit: (habitId: string, patch: Partial<{
    title: string;
    scheduleMask: number;
    reminderEnabled: boolean;
    reminderHour: number | null;
    reminderMinute: number | null;
  }>) =>
    request<{ id: string; title: string; scheduleMask: number; reminderEnabled: boolean; reminderHour: number | null; reminderMinute: number | null }>(
      `/habits/${habitId}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  removeHabit: (habitId: string) =>
    request<{ ok: true }>(`/habits/${habitId}`, { method: 'DELETE' }),

  previewDeleteGoal: (id: string) =>
    request<{
      goalId: string;
      goalTitle: string;
      completedTasks: number;
      pendingTasks: number;
      xpToLose: number;
    }>(`/goals/${id}/delete-preview`),

  deleteGoal: (id: string) =>
    request<{
      deletedGoalId: string;
      goalTitle: string;
      xpLost: number;
      user: { streakCurrent: number; streakBest: number; xpTotal: number; level: number };
    }>(`/goals/${id}`, { method: 'DELETE' }),

  plan: (goalId: string) => request<Plan>(`/goals/${goalId}/plan`),

  todayTasks: () => request<DailyTask[]>('/tasks/today'),

  toggleTask: (id: string) =>
    request<{
      task: DailyTask;
      user: { streakCurrent: number; xpTotal: number; level: number };
      newAchievements: Achievement[];
    }>(`/tasks/${id}/toggle`, { method: 'POST' }),

  progress: () => request<ProgressOverview>('/progress'),

  leaderboard: (scope?: LeaderboardScope) =>
    request<Leaderboard>(`/leaderboard${scope ? `?scope=${scope}` : ''}`),

  season: () => request<SeasonView>('/seasons/current'),

  goalInsights: (id: string) => request<GoalInsights>(`/goals/${id}/insights`),

  streakFreeze: () =>
    request<{ streakCurrent: number; streakFreezesLeft: number }>(
      '/progress/streak-freeze',
      { method: 'POST' },
    ),

  leaguesMe: () => request<LeaguesMe>('/leagues/me'),

  bonusToday: () => request<BonusTask | null>('/bonus/today'),
  completeBonus: (id: string) =>
    request<{ bonus: BonusTask; xpTotal: number }>(`/bonus/${id}/complete`, { method: 'POST' }),

  prices: () => request<{ trialPriceRub: number; monthlyPriceRub: number; premiumStars: number }>('/payments/prices'),

  startYooKassaTrial: () =>
    request<{ confirmationUrl: string; subscriptionId: string }>('/payments/yookassa/start-trial', { method: 'POST' }),

  starsInvoice: () => request<{ invoiceLink: string; payload: string }>('/payments/stars/invoice', { method: 'POST' }),

  claimTrial: () =>
    request<{ isPremium: boolean; premiumUntil: string; trialClaimedAt: string }>(
      '/payments/trial/claim',
      { method: 'POST' },
    ),

  cardInvoice: () =>
    request<{ invoiceLink: string; payload: string }>('/payments/card/invoice', { method: 'POST' }),

  // --- In-app admin (only works for admin Telegram IDs) ---
  adminStats: () => request<AdminStats>('/app-admin/stats'),
  adminUsers: (q?: string) =>
    request<AdminUser[]>(`/app-admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  adminSetPremium: (
    id: string,
    opts: { isPremium: boolean; days?: number; forever?: boolean },
  ) =>
    request<{ id: string; isPremium: boolean; premiumUntil: string | null }>(
      `/app-admin/users/${id}/premium`,
      { method: 'POST', body: JSON.stringify(opts) },
    ),
  adminFeedback: () => request<AdminFeedback[]>('/app-admin/feedback'),
  adminEvents: () => request<AdminEvent[]>('/app-admin/events'),
};

export { ApiError };
