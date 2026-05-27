import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { GoalCategory } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AiPlanResponse, AiPlanRequest } from '../ai/ai.types';

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
  ) {}

  async generateForGoal(
    goalId: string,
    req: { category: GoalCategory; goalTitle: string; horizonDays: number; language: 'ru' | 'en' },
  ): Promise<AiPlanResponse> {
    const cacheKey = hashKey([req.category, req.horizonDays, req.language].join('|'));
    const cached = await this.prisma.planCache.findUnique({ where: { cacheKey } });

    const plan: AiPlanResponse = cached
      ? (cached.payload as unknown as AiPlanResponse)
      : await this.ai.generatePlan({
          category: req.category as AiPlanRequest['category'],
          goalTitle: req.goalTitle,
          horizonDays: req.horizonDays,
          language: req.language,
        });

    if (!cached) {
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

  async getForGoal(goalId: string, userId: string): Promise<AiPlanResponse> {
    const plan = await this.prisma.plan.findUnique({
      where: { goalId },
      include: { goal: true },
    });
    if (!plan || plan.goal.userId !== userId) throw new NotFoundException('Plan not found');
    return plan.payload as unknown as AiPlanResponse;
  }
}

function hashKey(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32);
}
