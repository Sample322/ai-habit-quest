import { Controller, Get } from '@nestjs/common';

import { AiService } from './ai.service';

/**
 * Diagnostics for the backend -> ai-service link. Public + read-only: it never
 * returns secrets, only whether the configured ai-service is reachable and
 * whether it produces a real (non-stub) plan. Use it to catch a stale
 * AI_SERVICE_URL immediately, instead of discovering it via stub plans.
 */
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get('diag')
  diag() {
    return this.ai.probe();
  }
}
