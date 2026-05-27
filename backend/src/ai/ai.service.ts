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
    this.http = axios.create({
      baseURL: envString('AI_SERVICE_URL', 'http://ai-service:8000'),
      timeout: 30_000,
    });
  }

  async generatePlan(req: AiPlanRequest): Promise<AiPlanResponse> {
    try {
      const { data } = await this.http.post<AiPlanResponse>('/generate-plan', req);
      if (data && Array.isArray(data.schedule) && data.schedule.length > 0) {
        return data;
      }
      this.logger.warn('ai-service returned empty plan, using local stub');
    } catch (err) {
      this.logger.warn(`ai-service unreachable, falling back to local stub: ${(err as Error).message}`);
    }
    return localStubPlan(req);
  }
}
