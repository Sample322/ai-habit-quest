import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SeasonStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const SEASON_LENGTH_DAYS = 28;
const TOP_REWARDS: { maxRank: number; days: number; kind: string }[] = [
  { maxRank: 1, days: 14, kind: 'premium_14d' },
  { maxRank: 3, days: 7, kind: 'premium_7d' },
  { maxRank: 10, days: 3, kind: 'premium_3d' },
];

export interface SeasonView {
  number: number;
  startDate: string;
  endDate: string;
  daysLeft: number;
  myXp: number;
  myRank: number;
  totalPlayers: number;
  top: {
    position: number;
    id: string;
    name: string;
    xp: number;
    isMe: boolean;
  }[];
  rewardTiers: { maxRank: number; days: number }[];
}

@Injectable()
export class SeasonsService {
  private readonly logger = new Logger(SeasonsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Caller's season snapshot: current standings + my XP/rank + reward tiers. */
  async overview(userId: string, lang: 'ru' | 'en'): Promise<SeasonView> {
    const season = await this.ensureActiveSeason();

    // Compute seasonal XP for all participants by summing DailyTask.xpAwarded
    // (where doneAt >= season.startDate) + BonusTask.xp (where doneAt is in
    // range). We compute live on read; with a small user base this is cheap
    // and avoids stale snapshots.
    const start = season.startDate;
    const startTs = new Date(start);
    startTs.setUTCHours(0, 0, 0, 0);

    const [daily, bonuses] = await Promise.all([
      this.prisma.dailyTask.groupBy({
        by: ['userId'],
        where: { doneAt: { gte: startTs } },
        _sum: { xpAwarded: true },
      }),
      this.prisma.bonusTask.groupBy({
        by: ['userId'],
        where: { doneAt: { gte: startTs } },
        _sum: { xp: true },
      }),
    ]);

    const xpByUser = new Map<string, number>();
    for (const d of daily) xpByUser.set(d.userId, d._sum.xpAwarded ?? 0);
    for (const b of bonuses) {
      xpByUser.set(b.userId, (xpByUser.get(b.userId) ?? 0) + (b._sum.xp ?? 0));
    }

    const sorted = Array.from(xpByUser.entries())
      .map(([id, xp]) => ({ id, xp }))
      .sort((a, b) => b.xp - a.xp);

    const myXp = xpByUser.get(userId) ?? 0;
    const myIdx = sorted.findIndex((e) => e.id === userId);
    const myRank = myIdx >= 0 ? myIdx + 1 : sorted.length + 1;

    const topIds = sorted.slice(0, 10).map((e) => e.id);
    const topUsers = topIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: topIds } },
          select: { id: true, firstName: true, username: true },
        })
      : [];
    const nameById = new Map(topUsers.map((u) => [u.id, u.firstName || u.username || (lang === 'en' ? 'Player' : 'Игрок')]));

    const top = sorted.slice(0, 10).map((e, i) => ({
      position: i + 1,
      id: e.id,
      name: nameById.get(e.id) ?? (lang === 'en' ? 'Player' : 'Игрок'),
      xp: e.xp,
      isMe: e.id === userId,
    }));

    const now = new Date();
    const endTs = new Date(season.endDate);
    endTs.setUTCHours(23, 59, 59, 0);
    const daysLeft = Math.max(0, Math.ceil((endTs.getTime() - now.getTime()) / 86_400_000));

    return {
      number: season.number,
      startDate: season.startDate.toISOString().slice(0, 10),
      endDate: season.endDate.toISOString().slice(0, 10),
      daysLeft,
      myXp,
      myRank,
      totalPlayers: sorted.length,
      top,
      rewardTiers: TOP_REWARDS.map(({ maxRank, days }) => ({ maxRank, days })),
    };
  }

  /**
   * Hourly: if the current active season's endDate is past, close it (snapshot
   * top-10 → SeasonResult, grant Premium days to ranks 1/3/10), then open a
   * fresh season starting today.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async closeIfDue(): Promise<void> {
    const active = await this.prisma.season.findFirst({ where: { status: SeasonStatus.active } });
    if (!active) {
      await this.ensureActiveSeason();
      return;
    }
    const now = new Date();
    const endTs = new Date(active.endDate);
    endTs.setUTCHours(23, 59, 59, 999);
    if (now < endTs) return;

    await this.closeSeason(active.id);
  }

  /** Public so admins can force-close in tests. */
  async closeSeason(seasonId: string): Promise<void> {
    const season = await this.prisma.season.findUniqueOrThrow({ where: { id: seasonId } });
    if (season.status !== SeasonStatus.active) return;

    const startTs = new Date(season.startDate);
    startTs.setUTCHours(0, 0, 0, 0);
    const endTs = new Date(season.endDate);
    endTs.setUTCHours(23, 59, 59, 999);

    const [daily, bonuses] = await Promise.all([
      this.prisma.dailyTask.groupBy({
        by: ['userId'],
        where: { doneAt: { gte: startTs, lte: endTs } },
        _sum: { xpAwarded: true },
      }),
      this.prisma.bonusTask.groupBy({
        by: ['userId'],
        where: { doneAt: { gte: startTs, lte: endTs } },
        _sum: { xp: true },
      }),
    ]);

    const xpByUser = new Map<string, number>();
    for (const d of daily) xpByUser.set(d.userId, d._sum.xpAwarded ?? 0);
    for (const b of bonuses) xpByUser.set(b.userId, (xpByUser.get(b.userId) ?? 0) + (b._sum.xp ?? 0));

    const sorted = Array.from(xpByUser.entries())
      .filter(([, xp]) => xp > 0)
      .map(([id, xp]) => ({ id, xp }))
      .sort((a, b) => b.xp - a.xp);

    // Persist results + apply rewards.
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const rank = i + 1;
      const tier = TOP_REWARDS.find((r) => rank <= r.maxRank);

      await this.prisma.seasonResult.upsert({
        where: { seasonId_userId: { seasonId, userId: entry.id } },
        update: { seasonalXp: entry.xp, finalRank: rank, rewardKind: tier?.kind ?? null },
        create: {
          seasonId,
          userId: entry.id,
          seasonalXp: entry.xp,
          finalRank: rank,
          rewardKind: tier?.kind ?? null,
        },
      });

      if (tier) await this.grantPremium(entry.id, tier.days);
    }

    await this.prisma.season.update({ where: { id: seasonId }, data: { status: SeasonStatus.closed } });

    // Start next season immediately so the leaderboard is never empty.
    await this.openNextSeason(season.number + 1);

    this.logger.log(`Season ${season.number} closed: ${sorted.length} ranked, top-10 rewarded`);
  }

  /** Ensure an active season exists; create season #1 on first call. */
  private async ensureActiveSeason() {
    let active = await this.prisma.season.findFirst({ where: { status: SeasonStatus.active } });
    if (active) return active;
    const last = await this.prisma.season.findFirst({ orderBy: { number: 'desc' } });
    const nextNum = (last?.number ?? 0) + 1;
    active = await this.openNextSeason(nextNum);
    return active;
  }

  private async openNextSeason(number: number) {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + SEASON_LENGTH_DAYS - 1);

    return this.prisma.season.create({
      data: { number, startDate: start, endDate: end, status: SeasonStatus.active },
    });
  }

  private async grantPremium(userId: string, days: number): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const ADMIN_SENTINEL = new Date('2099-12-31T23:59:59Z').getTime();
    if (user.premiumUntil && user.premiumUntil.getTime() === ADMIN_SENTINEL) return;

    const now = new Date();
    const base = user.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now;
    const newUntil = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    await this.prisma.user.update({
      where: { id: userId },
      data: { isPremium: true, premiumUntil: newUntil },
    });
  }
}
