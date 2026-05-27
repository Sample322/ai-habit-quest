import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

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

    const xpTotal = rows.reduce((sum, r) => sum + r.xpAwarded, 0);
    const level = computeLevel(xpTotal);

    const completedDays = new Set(
      rows
        .filter((r) => r.doneAt !== null)
        .map((r) => r.localDate.toISOString().slice(0, 10)),
    );

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
