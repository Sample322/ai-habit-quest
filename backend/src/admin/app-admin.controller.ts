import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUserGuard } from './admin-user.guard';

class SetPremiumDto {
  @IsBoolean()
  isPremium!: boolean;

  @IsOptional() @IsString()
  until?: string;
}

/**
 * In-app admin API — same data as the Basic-auth /admin/* endpoints, but
 * authorised via the user's JWT + admin Telegram ID, so the owner can manage
 * everything inside the Mini App without a terminal.
 */
@UseGuards(JwtAuthGuard, AdminUserGuard)
@Controller('app-admin')
export class AppAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('stats')
  async stats() {
    const now = Date.now();
    const d1 = new Date(now - 24 * 60 * 60 * 1000);
    const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const [
      users, premium, new24h, new7d,
      goals, activeGoals,
      plans, plansOpenai, plansStub,
      tasks, tasksDone,
      payEvents, paySucceeded,
      feedback,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isPremium: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: d1 } } }),
      this.prisma.user.count({ where: { createdAt: { gte: d7 } } }),
      this.prisma.goal.count(),
      this.prisma.goal.count({ where: { status: 'active' } }),
      this.prisma.plan.count(),
      this.prisma.plan.count({ where: { provider: 'openai' } }),
      this.prisma.plan.count({ where: { provider: 'stub' } }),
      this.prisma.dailyTask.count(),
      this.prisma.dailyTask.count({ where: { doneAt: { not: null } } }),
      this.prisma.paymentEvent.count(),
      this.prisma.paymentEvent.count({ where: { status: 'succeeded' } }),
      this.prisma.feedback.count(),
    ]);
    const pct = (a: number, b: number): number => (b > 0 ? Math.round((a / b) * 100) : 0);
    return {
      generatedAt: new Date().toISOString(),
      users: { total: users, premium, new24h, new7d },
      goals: { total: goals, active: activeGoals },
      plans: { total: plans, openai: plansOpenai, stub: plansStub, aiHealthPct: pct(plansOpenai, plans) },
      tasks: { total: tasks, completed: tasksDone, completionPct: pct(tasksDone, tasks) },
      payments: { events: payEvents, succeeded: paySucceeded },
      feedback,
    };
  }

  @Get('users')
  async users(@Query('q') q?: string, @Query('premium') premium?: string) {
    const where: Record<string, unknown> = {};
    if (premium === 'true') where['isPremium'] = true;
    if (premium === 'false') where['isPremium'] = false;
    if (q) {
      where['OR'] = [
        { username: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, telegramId: true, username: true, firstName: true,
        languageCode: true, isPremium: true, premiumUntil: true,
        streakCurrent: true, xpTotal: true, level: true, createdAt: true,
      },
    });
    return users.map((u) => ({ ...u, telegramId: u.telegramId.toString() }));
  }

  @Post('users/:id/premium')
  async setPremium(@Param('id') id: string, @Body() body: SetPremiumDto) {
    const until = body.until ? new Date(body.until) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const u = await this.prisma.user.update({
      where: { id },
      data: { isPremium: body.isPremium, premiumUntil: body.isPremium ? until : null },
    });
    return { id: u.id, isPremium: u.isPremium, premiumUntil: u.premiumUntil };
  }

  @Get('feedback')
  async feedback() {
    const rows = await this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { username: true, firstName: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      message: r.message,
      createdAt: r.createdAt,
      user: r.user ? (r.user.username || r.user.firstName || 'аноним') : 'аноним',
    }));
  }
}
