import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';

/**
 * Drop stale ShareImage rows.
 *
 * Schema comment promised 24h retention but no cron was wired. PNG bytes
 * live in PostgreSQL `bytea` so the table balloons fast — every Story share
 * adds ~150-400 KB. Retain 14 days (covers any Telegram CDN re-pull window
 * for a freshly-shared Story) then prune.
 *
 * Runs once a day at 03:30 UTC — off-peak, hourly cron neighbours already
 * cover the other gamification jobs.
 */
@Injectable()
export class ShareCleanupService {
  private readonly logger = new Logger(ShareCleanupService.name);
  private static readonly RETENTION_DAYS = 14;

  constructor(private readonly prisma: PrismaService) {}

  @Cron('30 3 * * *', { timeZone: 'UTC' })
  async pruneOldShareImages(): Promise<void> {
    const cutoff = new Date(
      Date.now() - ShareCleanupService.RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    try {
      const result = await this.prisma.shareImage.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      if (result.count > 0) {
        this.logger.log(
          `pruned ${result.count} share images older than ${cutoff.toISOString()}`,
        );
      }
    } catch (err) {
      this.logger.error('share image prune failed', err as Error);
    }
  }
}
