import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { envString } from '../config/env';
import { AiPlanRequest, AiPlanResponse } from './ai.types';
import { localStubPlan } from './stub-plans';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  constructor() {
    // No silent localhost default in production: on Timeweb each app has its
    // own public domain, so a missing/stale AI_SERVICE_URL is the #1 cause of
    // plans silently falling back to the local stub (ENOTFOUND). Surface it.
    this.baseUrl = envString('AI_SERVICE_URL', 'http://ai-service:8000');
    this.logger.log(`AI client configured baseURL=${this.baseUrl}`);
    this.http = axios.create({
      baseURL: this.baseUrl,
      // ai-service budgets up to 60s for the upstream LLM call; we must wait
      // longer than that or we cut off legitimate (slow) generations and fall
      // back to the stub. 90s > ai-service's own 60s ceiling.
      timeout: 90_000,
      // Don't auto-throw on 4xx/5xx so we can log the actual server reply
      // when the upstream service returned an error envelope instead of a plan.
      validateStatus: () => true,
    });
  }

  /**
   * Ask ai-service for one optional "stretch" bonus action for today.
   * Returns null on any failure so the caller can simply skip the bonus.
   */
  async generateBonusTask(req: {
    category: string;
    goalTitle: string;
    language: 'ru' | 'en';
    recentTitles: string[];
  }): Promise<{ provider: string; title: string; xp: number } | null> {
    try {
      const resp = await this.http.post('/bonus-task', req);
      const data = resp.data as { provider?: string; title?: string; xp?: number };
      if (resp.status < 400 && data && typeof data.title === 'string' && data.title.length > 0) {
        return { provider: data.provider ?? 'stub', title: data.title, xp: data.xp ?? 25 };
      }
      this.logger.warn(`bonus-task bad response status=${resp.status}`);
    } catch (err) {
      this.logger.warn(`bonus-task unreachable: ${(err as Error).message}`);
    }
    return null;
  }

  /**
   * Connectivity + end-to-end diagnostic for the backend -> ai-service path.
   * No secrets are returned. Lets us confirm — without creating a goal — that
   * the backend can reach ai-service and get a real (non-stub) plan back.
   */
  async probe(): Promise<{
    baseUrl: string;
    healthz: { ok: boolean; status?: number; body?: unknown; error?: string };
    sample: { ok: boolean; provider?: string; scheduleDays?: number; ms: number; error?: string };
  }> {
    const healthz: { ok: boolean; status?: number; body?: unknown; error?: string } = { ok: false };
    try {
      const r = await this.http.get('/healthz', { timeout: 10_000 });
      healthz.ok = r.status < 400;
      healthz.status = r.status;
      healthz.body = r.data;
    } catch (err) {
      healthz.error = (err as Error).message;
    }

    const started = Date.now();
    const sample: { ok: boolean; provider?: string; scheduleDays?: number; ms: number; error?: string } = {
      ok: false,
      ms: 0,
    };
    try {
      const plan = await this.generatePlan({
        category: 'custom',
        goalTitle: 'diagnostic ping',
        horizonDays: 7,
        level: 'beginner',
        language: 'en',
      });
      sample.ok = plan.provider !== 'stub';
      sample.provider = plan.provider;
      sample.scheduleDays = plan.schedule.length;
    } catch (err) {
      sample.error = (err as Error).message;
    }
    sample.ms = Date.now() - started;

    return { baseUrl: this.baseUrl, healthz, sample };
  }

  async generatePlan(req: AiPlanRequest): Promise<AiPlanResponse> {
    try {
      const resp = await this.http.post<AiPlanResponse>('/generate-plan', req);
      const data = resp.data;
      const bodyPreview = (): string => {
        const s = typeof data === 'string' ? data : JSON.stringify(data);
        return s.slice(0, 500);
      };
      if (resp.status >= 400) {
        this.logger.warn(
          `ai-service HTTP ${resp.status} ${resp.statusText} for "${req.goalTitle}": ${bodyPreview()}`,
        );
      } else if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
        this.logger.log(
          `ai-service responded provider=${data.provider} schedule_days=${data.schedule.length} habits=${data.habits?.length ?? 0} for "${req.goalTitle}"`,
        );
        return data;
      } else {
        this.logger.warn(
          `ai-service returned empty/invalid plan for "${req.goalTitle}" (status=${resp.status}): ${bodyPreview()}`,
        );
      }
    } catch (err) {
      this.logger.warn(`ai-service unreachable, falling back to local stub: ${(err as Error).message}`);
    }
    return localStubPlan(req);
  }
}
