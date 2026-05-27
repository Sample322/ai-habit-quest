export type AiPlanCategory = 'sport' | 'study' | 'discipline' | 'custom';

export interface AiPlanRequest {
  category: AiPlanCategory;
  goalTitle: string;
  horizonDays: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  language?: 'ru' | 'en';
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
  provider: 'stub' | 'ollama';
  category: AiPlanCategory;
  horizonDays: number;
  habits: AiPlanHabit[]; // suggested habits to attach to the goal
  schedule: AiPlanDay[];
}
