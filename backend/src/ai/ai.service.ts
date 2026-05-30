import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

import { envString } from '../config/env';
import { AiPlanRequest, AiPlanResponse } from './ai.types';
import { localStubPlan } from './stub-plans';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly http: AxiosInstance;

  constructor() {
    const baseUrl = envString('AI_SERVICE_URL', 'http://ai-service:8000');
    this.logger.log(`AI client configured baseURL=${baseUrl}`);
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 30_000,
      // Don't auto-throw on 4xx/5xx so we can log the actual server reply
      // when the upstream service returned an error envelope instead of a plan.
      validateStatus: () => true,
    });
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
