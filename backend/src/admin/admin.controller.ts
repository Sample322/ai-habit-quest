import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { AdminBasicAuthGuard } from './admin.guard';

interface AdminStats {
  generatedAt: string;
  users: { total: number; premium: number; new24h: number; new7d: number };
  goals: { total: number; active: number };
  plans: { total: number; openai: number; stub: number; aiHealthPct: number };
  tasks: { total: number; completed: number; completionPct: number };
  payments: { events: number; succeeded: number };
  feedback: number;
}

class GrantPremiumDto {
  @IsBoolean()
  isPremium!: boolean;

  @IsOptional() @IsString()
  until?: string; // ISO date
}

@UseGuards(AdminBasicAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  async listUsers(@Query('q') q?: string, @Query('premium') premium?: string) {
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
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        languageCode: true,
        isPremium: true,
        premiumUntil: true,
        streakCurrent: true,
        xpTotal: true,
        level: true,
        createdAt: true,
      },
    });
    return users.map((u) => ({ ...u, telegramId: u.telegramId.toString() }));
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        goals: { include: { habits: true } },
        subscriptions: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!u) return null;
    return { ...u, telegramId: u.telegramId.toString() };
  }

  @Post('users/:id/premium')
  async grantPremium(@Param('id') id: string, @Body() body: GrantPremiumDto) {
    const until = body.until ? new Date(body.until) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const u = await this.prisma.user.update({
      where: { id },
      data: {
        isPremium: body.isPremium,
        premiumUntil: body.isPremium ? until : null,
      },
    });
    return { id: u.id, isPremium: u.isPremium, premiumUntil: u.premiumUntil };
  }

  @Get('payments')
  async listPayments() {
    const rows = await this.prisma.paymentEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { username: true, firstName: true } } },
    });
    return rows;
  }

  @Get('feedback')
  async listFeedback() {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { username: true, firstName: true } } },
    });
  }

  @Get('stats')
  stats(): Promise<AdminStats> {
    return this.computeStats();
  }

  /** Minimal self-contained HTML dashboard (Basic-auth protected, no JS). */
  @Get('dashboard')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async dashboard(): Promise<string> {
    const s = await this.computeStats();
    const card = (label: string, value: string | number, hint = ''): string =>
      `<div class="c"><div class="v">${value}</div><div class="l">${label}</div>${hint ? `<div class="h">${hint}</div>` : ''}</div>`;
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AHQ — статистика</title>
<style>
:root{color-scheme:dark}
body{margin:0;background:#0f1115;color:#e8eaed;font:15px/1.4 system-ui,sans-serif;padding:24px}
h1{font-size:18px;margin:0 0 4px} .sub{color:#8b8f96;font-size:12px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.c{background:#191c22;border:1px solid #262a33;border-radius:14px;padding:16px}
.v{font-size:26px;font-weight:700} .l{color:#9aa0a8;font-size:12px;margin-top:4px} .h{color:#6f7480;font-size:11px;margin-top:6px}
.sec{margin:24px 0 10px;font-size:13px;color:#9aa0a8;text-transform:uppercase;letter-spacing:.08em}
</style></head><body>
<h1>AI Habit Quest — статистика</h1>
<div class="sub">обновлено: ${s.generatedAt}</div>
<div class="sec">Пользователи</div>
<div class="grid">
${card('Всего', s.users.total)}
${card('Premium', s.users.premium)}
${card('Новые 24ч', s.users.new24h)}
${card('Новые 7д', s.users.new7d)}
</div>
<div class="sec">Цели и планы</div>
<div class="grid">
${card('Целей', s.goals.total, `активных: ${s.goals.active}`)}
${card('Планов', s.plans.total)}
${card('AI-планы', s.plans.openai, `заглушек: ${s.plans.stub}`)}
${card('AI-здоровье', s.plans.aiHealthPct + '%', 'openai / всего')}
</div>
<div class="sec">Активность и деньги</div>
<div class="grid">
${card('Задач', s.tasks.total, `выполнено: ${s.tasks.completed}`)}
${card('Выполнение', s.tasks.completionPct + '%')}
${card('Платежи', s.payments.events, `успешных: ${s.payments.succeeded}`)}
${card('Фидбек', s.feedback)}
</div>
</body></html>`;
  }

  private async computeStats(): Promise<AdminStats> {
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
}
