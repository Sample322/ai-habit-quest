import { BadRequestException, Controller, ForbiddenException, Get, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from './gamification.service';
import { LeaguesService } from './leagues.service';
import { computeRank, computeAchievements } from './progress-extras';
import { todayLocalDate } from '../tasks/tasks.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class GamificationController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
    private readonly leagues: LeaguesService,
  ) {}

  @Get('leagues/me')
  leaguesMe(@CurrentUser() me: AuthenticatedUser) {
    const lang = me.languageCode === 'en' ? 'en' : 'ru';
    return this.leagues.leaguesMe(me.id, lang);
  }

  @Get('progress')
  async overview(@CurrentUser() me: AuthenticatedUser) {
    const state = await this.gamification.recompute(me.id);
    const lang = me.languageCode === 'en' ? 'en' : 'ru';

    // Last 7 days completion bar
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 6);

    const [rows, completedTasks, goals, referrals] = await Promise.all([
      this.prisma.dailyTask.findMany({ where: { userId: me.id, localDate: { gte: since } } }),
      this.prisma.dailyTask.count({ where: { userId: me.id, doneAt: { not: null } } }),
      this.prisma.goal.count({ where: { userId: me.id } }),
      this.prisma.user.count({ where: { referredById: me.id } }),
    ]);

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

    const rank = computeRank(state.xpTotal, lang);
    const achievements = computeAchievements(
      { xpTotal: state.xpTotal, streakBest: state.streakBest, completedTasks, goals, referrals },
      lang,
    );

    return { ...state, last7, rank, achievements, completedTasks };
  }

  /**
   * D1: streak-freeze. Premium-only. Restores yesterday if the user has a
   * charge left this month. Charges reset on month rollover.
   */
  @Post('progress/streak-freeze')
  async streakFreeze(@CurrentUser() me: AuthenticatedUser) {
    if (!me.isPremium) {
      throw new ForbiddenException({ code: 'premium_required', message: 'Streak freeze is a Premium feature.' });
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    const today = todayLocalDate(user.timezone);
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    const yKey = yesterday.toISOString().slice(0, 10);
    const monthKey = today.toISOString().slice(0, 7);

    // Already frozen → no-op (idempotent).
    if (user.streakFreezeDates.includes(yKey)) {
      throw new BadRequestException({ code: 'already_used', message: 'Yesterday is already frozen.' });
    }

    // Reset monthly counter on rollover.
    const freshMonth = user.streakFreezesMonth !== monthKey;
    const left = freshMonth ? 2 : user.streakFreezesLeft;
    if (left <= 0) {
      throw new BadRequestException({ code: 'out_of_freezes', message: 'No streak freezes left this month.' });
    }

    await this.prisma.user.update({
      where: { id: me.id },
      data: {
        streakFreezeDates: { push: yKey },
        streakFreezesLeft: left - 1,
        streakFreezesMonth: monthKey,
      },
    });

    const after = await this.gamification.recompute(me.id);
    return {
      streakCurrent: after.streakCurrent,
      streakFreezesLeft: left - 1,
    };
  }

  /** Live XP leaderboard: top players + the caller's own rank. */
  @Get('leaderboard')
  async leaderboard(@CurrentUser() me: AuthenticatedUser) {
    const top = await this.prisma.user.findMany({
      orderBy: [{ xpTotal: 'desc' }, { createdAt: 'asc' }],
      take: 20,
      select: { id: true, firstName: true, username: true, xpTotal: true, level: true, streakCurrent: true },
    });

    const meRow = await this.prisma.user.findUniqueOrThrow({
      where: { id: me.id },
      select: { xpTotal: true },
    });
    // Rank = how many users have strictly more XP, +1.
    const ahead = await this.prisma.user.count({ where: { xpTotal: { gt: meRow.xpTotal } } });
    const totalPlayers = await this.prisma.user.count();

    return {
      myRank: ahead + 1,
      totalPlayers,
      top: top.map((u, i) => ({
        position: i + 1,
        id: u.id,
        name: u.firstName || u.username || (me.languageCode === 'en' ? 'Player' : 'Игрок'),
        xp: u.xpTotal,
        level: u.level,
        streak: u.streakCurrent,
        isMe: u.id === me.id,
      })),
    };
  }
}
