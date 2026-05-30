import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GoalCategory } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AiPlanResponse, AiPlanRequest } from '../ai/ai.types';

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async generateForGoal(
    goalId: string,
    req: { category: GoalCategory; goalTitle: string; horizonDays: number; language: 'ru' | 'en' },
  ): Promise<AiPlanResponse> {
    // Cache key includes the normalized goalTitle so different goals get
    // different AI plans, AND so a previously cached `stub` fallback never
    // gets returned for a brand-new goal title.
    const cacheKey = buildCacheKey(req);
    const cached = await this.prisma.planCache.findUnique({ where: { cacheKey } });

    let plan: AiPlanResponse;
    if (cached) {
      plan = cached.payload as unknown as AiPlanResponse;
      this.logger.log(
        `plan cache HIT goal=${goalId} title="${req.goalTitle}" provider=${plan.provider}`,
      );
    } else {
      plan = await this.ai.generatePlan({
        category: req.category as AiPlanRequest['category'],
        goalTitle: req.goalTitle,
        horizonDays: req.horizonDays,
        language: req.language,
      });
      this.logger.log(
        `plan generated goal=${goalId} title="${req.goalTitle}" provider=${plan.provider}`,
      );
    }

    // Only cache real (non-stub) plans. A stub response means the upstream
    // AI provider just failed — caching it would lock the goal into the
    // fallback forever, which is exactly the bug we're avoiding here.
    if (!cached && plan.provider !== 'stub') {
      await this.prisma.planCache.create({
        data: {
          cacheKey,
          category: req.category,
          horizonDays: req.horizonDays,
          provider: plan.provider,
          payload: plan as unknown as object,
        },
      });
    }

    // Upsert the plan + create habit rows if none exist yet.
    await this.prisma.$transaction(async (tx) => {
      await tx.plan.upsert({
        where: { goalId },
        update: {
          horizonDays: plan.horizonDays,
          provider: plan.provider,
          payload: plan as unknown as object,
        },
        create: {
          goalId,
          horizonDays: plan.horizonDays,
          provider: plan.provider,
          payload: plan as unknown as object,
        },
      });

      const existingHabits = await tx.habit.count({ where: { goalId } });
      if (existingHabits === 0) {
        const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
        await tx.habit.createMany({
          data: plan.habits.slice(0, 3).map((h, idx) => ({
            userId: goal.userId,
            goalId,
            title: h.title,
            position: idx,
          })),
        });
      }
    });

    return plan;
  }

  /**
   * Force a fresh plan for an existing goal (user-triggered "regenerate"),
   * bypassing the cache. Crucially, we generate FIRST and only replace the
   * goal's plan + habits when the result is a real (non-stub) plan — so a
   * transient AI outage can never downgrade a good plan to the stub. The old
   * habits (and their daily tasks) are replaced; the caller re-materialises
   * today's tasks and recomputes gamification to keep XP/streak consistent.
   */
  async regenerateForGoal(
    goalId: string,
    req: { category: GoalCategory; goalTitle: string; horizonDays: number; language: 'ru' | 'en' },
  ): Promise<AiPlanResponse> {
    const plan = await this.ai.generatePlan({
      category: req.category as AiPlanRequest['category'],
      goalTitle: req.goalTitle,
      horizonDays: req.horizonDays,
      language: req.language,
    });

    if (plan.provider === 'stub') {
      throw new ServiceUnavailableException({
        code: 'ai_busy',
        message: 'AI is busy right now — please try again in a moment.',
      });
    }

    this.logger.log(
      `plan regenerated goal=${goalId} title="${req.goalTitle}" provider=${plan.provider}`,
    );

    // Refresh the cache with the real plan so repeat creations of the same
    // (category, horizon, language, title) reuse it instead of regenerating.
    const cacheKey = buildCacheKey(req);
    await this.prisma.planCache.upsert({
      where: { cacheKey },
      update: {
        category: req.category,
        horizonDays: req.horizonDays,
        provider: plan.provider,
        payload: plan as unknown as object,
      },
      create: {
        cacheKey,
        category: req.category,
        horizonDays: req.horizonDays,
        provider: plan.provider,
        payload: plan as unknown as object,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.plan.upsert({
        where: { goalId },
        update: {
          horizonDays: plan.horizonDays,
          provider: plan.provider,
          payload: plan as unknown as object,
        },
        create: {
          goalId,
          horizonDays: plan.horizonDays,
          provider: plan.provider,
          payload: plan as unknown as object,
        },
      });

      // Replace habits: deleting them cascades their DailyTasks (Prisma
      // onDelete: Cascade), so stale stub tasks disappear with the old plan.
      await tx.habit.deleteMany({ where: { goalId } });
      const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
      await tx.habit.createMany({
        data: plan.habits.slice(0, 3).map((h, idx) => ({
          userId: goal.userId,
          goalId,
          title: h.title,
          position: idx,
        })),
      });
    });

    return plan;
  }

  async getForGoal(goalId: string, userId: string): Promise<AiPlanResponse> {
    const plan = await this.prisma.plan.findUnique({
      where: { goalId },
      include: { goal: true },
    });
    if (!plan || plan.goal.userId !== userId) throw new NotFoundException('Plan not found');
    return plan.payload as unknown as AiPlanResponse;
  }
}

function buildCacheKey(req: {
  category: GoalCategory;
  goalTitle: string;
  horizonDays: number;
  language: 'ru' | 'en';
}): string {
  const normalisedTitle = req.goalTitle.trim().toLowerCase().slice(0, 80);
  return hashKey([req.category, req.horizonDays, req.language, normalisedTitle].join('|'));
}

function hashKey(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}
