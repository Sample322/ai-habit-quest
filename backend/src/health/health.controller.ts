import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

// The platform healthcheck hits /health frequently — it must never be
// rate-limited (a throttled 429 would mark the container unhealthy).
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lightweight liveness probe. No DB call — must respond instantly so the
   * platform's healthcheck never times out on cold-start Prisma queries.
   */
  @Get('health')
  health(): { status: 'ok'; ts: string } {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  /**
   * Deeper readiness probe — separate endpoint so the orchestrator's
   * lightweight liveness probe stays cheap.
   */
  @Get('health/db')
  async healthDb(): Promise<{ status: 'ok' | 'degraded'; db: 'up' | 'down'; ts: string }> {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db, ts: new Date().toISOString() };
  }
}
