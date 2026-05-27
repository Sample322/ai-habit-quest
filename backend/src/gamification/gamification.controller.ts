import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';

@UseGuards(JwtAuthGuard)
@Controller('progress')
export class GamificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  @Get()
  async overview(@CurrentUser() me: AuthenticatedUser) {
    const state = await this.gamification.recompute(me.id);

    // Last 7 days completion bar
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 6);

    const rows = await this.prisma.dailyTask.findMany({
      where: { userId: me.id, localDate: { gte: since } },
    });

    const byDate = new Map<string, { total: number; done: number }>();
    for (const r of rows) {
      const k = r.localDate.toISOString().slice(0, 10);
      const e = byDate.get(k) ?? { total: 0, done: 0 };
      e.total++;
      if (r.doneAt) e.done++;
      byDate.set(k, e);
    }

    const last7: { date: string; total: number; done: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const k = d.toISOString().slice(0, 10);
      const e = byDate.get(k) ?? { total: 0, done: 0 };
      last7.push({ date: k, total: e.total, done: e.done });
    }

    return { ...state, last7 };
  }
}
