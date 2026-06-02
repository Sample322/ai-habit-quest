import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUserGuard } from './admin-user.guard';

class SetPremiumDto {
  @IsBoolean()
  isPremium!: boolean;

  /** Pass a concrete date or omit (defaults to +31d). Ignored if `days` set. */
  @IsOptional() @IsString()
  until?: string;

  /** Convenience: grant N days of Premium from now. Overrides `until`. */
  @IsOptional() @IsInt() @Min(1)
  days?: number;

  /** Grant the admin "forever" sentinel (2099-12-31). Highest priority. */
  @IsOptional() @IsBoolean()
  forever?: boolean;
}

const ADMIN_SENTINEL = new Date('2099-12-31T23:59:59Z');

export interface AdminEvent {
  id: string;
  kind: 'signup' | 'goal' | 'payment' | 'feedback';
  at: string;
  who: string;
  label: string;
  meta?: string;
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
    let premiumUntil: Date | null = null;
    if (body.isPremium) {
      if (body.forever) premiumUntil = ADMIN_SENTINEL;
      else if (body.days && body.days > 0) premiumUntil = new Date(Date.now() + body.days * 24 * 60 * 60 * 1000);
      else if (body.until) premiumUntil = new Date(body.until);
      else premiumUntil = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    }
    const u = await this.prisma.user.update({
      where: { id },
      data: { isPremium: body.isPremium, premiumUntil },
    });
    return { id: u.id, isPremium: u.isPremium, premiumUntil: u.premiumUntil };
  }

  /**
   * X: events feed. Synthesises a recent-activity timeline from existing
   * tables (signups, goal creates, payment events, feedback). No new schema —
   * cheap to compute, latest 60 entries.
   */
  @Get('events')
  async events() {
    const limit = 30;
    const [users, goals, payments, feedback] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: { id: true, firstName: true, username: true, createdAt: true, referredById: true },
      }),
      this.prisma.goal.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, title: true, category: true, createdAt: true,
          user: { select: { firstName: true, username: true } },
        },
      }),
      this.prisma.paymentEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, status: true, provider: true, amountMinor: true, currency: true, createdAt: true,
          user: { select: { firstName: true, username: true } },
        },
      }),
      this.prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, message: true, createdAt: true,
          user: { select: { firstName: true, username: true } },
        },
      }),
    ]);

    /* eslint-disable @typescript-eslint/no-unused-vars */
    type Event = AdminEvent;
    const whoOf = (u: { firstName: string | null; username: string | null } | null): string =>
      u ? (u.firstName || u.username || 'anon') : 'anon';

    const events: Event[] = [
      ...users.map<Event>((u) => ({
        id: 'u:' + u.id,
        kind: 'signup',
        at: u.createdAt.toISOString(),
        who: u.firstName || u.username || 'anon',
        label: u.referredById ? 'signed up (via referral)' : 'signed up',
      })),
      ...goals.map<Event>((g) => ({
        id: 'g:' + g.id,
        kind: 'goal',
        at: g.createdAt.toISOString(),
        who: whoOf(g.user),
        label: `created goal "${g.title}"`,
        meta: g.category,
      })),
      ...payments.map<Event>((p) => ({
        id: 'p:' + p.id,
        kind: 'payment',
        at: p.createdAt.toISOString(),
        who: whoOf(p.user),
        label: `${p.status} · ${p.provider}`,
        meta: `${(p.amountMinor / 100).toFixed(2)} ${p.currency}`,
      })),
      ...feedback.map<Event>((f) => ({
        id: 'f:' + f.id,
        kind: 'feedback',
        at: f.createdAt.toISOString(),
        who: whoOf(f.user),
        label: f.message.slice(0, 80),
      })),
    ];
    events.sort((a, b) => b.at.localeCompare(a.at));
    return events.slice(0, 60);
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
