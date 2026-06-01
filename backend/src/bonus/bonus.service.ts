import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { GoalStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AiService } from '../ai/ai.service';
import { GamificationService } from '../gamification/gamification.service';
import { todayLocalDate } from '../tasks/tasks.service';

export interface BonusTaskView {
  id: string;
  title: string;
  xp: number;
  doneAt: string | null;
}

/**
 * Premium "AI micro-task": one optional, AI-generated stretch action per day,
 * worth bonus XP. Generated lazily when the user opens Today (no bot/cron
 * dependency), expires at end of the local day (we only ever look at "today").
 */
@Injectable()
export class BonusService {
  private readonly logger = new Logger(BonusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly ai: AiService,
    private readonly gamification: GamificationService,
  ) {}

  /** Return today's bonus task for a premium user, generating it on first call. */
  async getToday(userId: string): Promise<BonusTaskView | null> {
    const user = await this.users.findById(userId);
    if (!user.isPremium) return null;

    const localDate = todayLocalDate(user.timezone);

    const existing = await this.prisma.bonusTask.findUnique({
      where: { userId_localDate: { userId, localDate } },
    });
    if (existing) return toView(existing);

    // Pick the user's most recent active goal to theme the bonus around.
    const goal = await this.prisma.goal.findFirst({
      where: { userId, status: GoalStatus.active },
      orderBy: { createdAt: 'desc' },
    });
    if (!goal) return null;

    const recent = await this.prisma.bonusTask.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: { title: true },
    });

    const generated = await this.ai.generateBonusTask({
      category: goal.category,
      goalTitle: goal.title,
      language: user.languageCode === 'en' ? 'en' : 'ru',
      recentTitles: recent.map((r) => r.title),
    });
    if (!generated) return null;

    // Race-safe: unique (userId, localDate) means a concurrent request can't
    // create two; swallow the duplicate and read back the winner.
    try {
      const created = await this.prisma.bonusTask.create({
        data: {
          userId,
          goalId: goal.id,
          localDate,
          title: generated.title,
          xp: generated.xp,
          provider: generated.provider,
        },
      });
      return toView(created);
    } catch {
      const row = await this.prisma.bonusTask.findUnique({
        where: { userId_localDate: { userId, localDate } },
      });
      return row ? toView(row) : null;
    }
  }

  /** Complete today's bonus task, awarding its XP once. */
  async complete(userId: string, bonusId: string): Promise<{ bonus: BonusTaskView; xpTotal: number }> {
    const user = await this.users.findById(userId);
    if (!user.isPremium) throw new ForbiddenException({ code: 'premium_required', message: 'Premium feature' });

    const bonus = await this.prisma.bonusTask.findFirst({ where: { id: bonusId, userId } });
    if (!bonus) throw new NotFoundException('Bonus task not found');

    const localToday = todayLocalDate(user.timezone).toISOString().slice(0, 10);
    if (bonus.localDate.toISOString().slice(0, 10) !== localToday) {
      throw new BadRequestException("Only today's bonus can be completed");
    }
    if (bonus.doneAt) {
      const stats = await this.gamification.recompute(userId);
      return { bonus: toView(bonus), xpTotal: stats.xpTotal };
    }

    const updated = await this.prisma.bonusTask.update({
      where: { id: bonus.id },
      data: { doneAt: new Date() },
    });

    // recompute() now includes completed bonus XP, so the bonus is reflected
    // here and won't be lost on the next daily-task toggle.
    const stats = await this.gamification.recompute(userId);
    this.logger.log(`Bonus completed user=${userId} +${bonus.xp}xp -> ${stats.xpTotal}`);
    return { bonus: toView(updated), xpTotal: stats.xpTotal };
  }
}

function toView(b: { id: string; title: string; xp: number; doneAt: Date | null }): BonusTaskView {
  return { id: b.id, title: b.title, xp: b.xp, doneAt: b.doneAt ? b.doneAt.toISOString() : null };
}
