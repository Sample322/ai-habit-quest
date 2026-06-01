import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { bonusXpFor } from './progress-extras';

interface GamificationState {
  streakCurrent: number;
  streakBest: number;
  xpTotal: number;
  level: number;
}

const STREAK_LOOKBACK_DAYS = 60;

@Injectable()
export class GamificationService {
  constructor(private readonly prisma: PrismaService) {}

  async recompute(userId: string): Promise<GamificationState> {
    // Pull the last N days of tasks; a day "counts" if at least one task was completed.
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - STREAK_LOOKBACK_DAYS);

    const rows = await this.prisma.dailyTask.findMany({
      where: { userId, localDate: { gte: since } },
      orderBy: { localDate: 'desc' },
    });

    // XP = completed daily tasks (within window) + completed Premium bonus tasks
    // (all-time) + first-earn bonuses for achievement UserBadges. Including all
    // sources here keeps them from being lost when recompute overwrites xpTotal.
    const dailyXp = rows.reduce((sum, r) => sum + r.xpAwarded, 0);
    const bonusAgg = await this.prisma.bonusTask.aggregate({
      where: { userId, doneAt: { not: null } },
      _sum: { xp: true },
    });
    // Achievement bonus XP: stored as UserBadge rows (one per first earn).
    // Badge.code carries the achievement code; bonusXpFor() maps it to XP.
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: { badge: { select: { code: true } } },
    });
    const achievementBonusXp = userBadges.reduce((sum, ub) => sum + bonusXpFor(ub.badge.code), 0);
    const xpTotal = dailyXp + (bonusAgg._sum.xp ?? 0) + achievementBonusXp;
    const level = computeLevel(xpTotal);

    const completedDays = new Set(
      rows
        .filter((r) => r.doneAt !== null)
        .map((r) => r.localDate.toISOString().slice(0, 10)),
    );

    // D1: streak-freeze dates count as "completion" for streak math (but not XP).
    const freezeUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { streakFreezeDates: true },
    });
    for (const d of freezeUser.streakFreezeDates) completedDays.add(d);

    // Walk backwards from today; count consecutive days that have at least one completion.
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    let streak = 0;
    for (let i = 0; i < STREAK_LOOKBACK_DAYS; i++) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      if (completedDays.has(key)) streak++;
      else if (i === 0) continue; // grace for today — don't break streak just because today has no tick yet
      else break;
    }

    // Compute best streak across the lookback window.
    const completedSorted = Array.from(completedDays).sort();
    let best = 0;
    let run = 0;
    let prev: Date | null = null;
    for (const k of completedSorted) {
      const d = new Date(`${k}T00:00:00Z`);
      if (prev && (d.getTime() - prev.getTime()) === 86_400_000) {
        run++;
      } else {
        run = 1;
      }
      if (run > best) best = run;
      prev = d;
    }
    if (streak > best) best = streak;

    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const streakBest = Math.max(before.streakBest, best);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        streakCurrent: streak,
        streakBest,
        xpTotal,
        level,
      },
    });

    return { streakCurrent: streak, streakBest, xpTotal, level };
  }
}

export function computeLevel(xp: number): number {
  if (xp <= 0) return 0;
  return Math.floor(Math.sqrt(xp / 50));
}
