export type AiPlanCategory = 'sport' | 'study' | 'discipline' | 'custom';

export type AiCoachingStyle = 'gentle' | 'strict' | 'humor';

export interface AiPlanRequest {
  category: AiPlanCategory;
  goalTitle: string;
  horizonDays: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  language?: 'ru' | 'en';
  /** TT: Premium-only coaching tone override forwarded to ai-service. */
  coachingStyle?: AiCoachingStyle | null;
}

export interface AiPlanHabit {
  title: string;
  description?: string;
}

export interface AiPlanDay {
  day: number; // 1-based
  tasks: string[]; // max 3
}

export interface AiPlanResponse {
  provider: 'stub' | 'ollama' | 'openai';
  category: AiPlanCategory;
  horizonDays: number;
  habits: AiPlanHabit[]; // suggested habits to attach to the goal
  schedule: AiPlanDay[];
}
