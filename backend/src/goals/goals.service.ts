import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { GoalCategory, GoalStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PlansService } from '../plans/plans.service';

export interface CreateGoalInput {
  title: string;
  category: GoalCategory;
}

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly plans: PlansService,
  ) {}

  async listForUser(userId: string) {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { habits: { orderBy: { position: 'asc' } } },
    });
  }

  async createForUser(userId: string, input: CreateGoalInput) {
    const user = await this.users.findById(userId);

    const title = input.title?.trim();
    if (!title || title.length < 2) throw new BadRequestException('Goal title is too short');

    const activeCount = await this.prisma.goal.count({
      where: { userId, status: GoalStatus.active },
    });
    const limit = user.isPremium ? Infinity : this.users.freeMaxGoals();
    if (activeCount >= limit) {
      throw new ForbiddenException({
        code: 'free_goal_limit',
        message: 'Free tier allows only one active goal — upgrade to Premium for more.',
      });
    }

    const horizonDays = user.isPremium ? 30 : this.users.freePlanHorizon();

    const goal = await this.prisma.goal.create({
      data: {
        userId,
        title,
        category: input.category,
        horizonDays,
        status: GoalStatus.active,
      },
    });

    // Generate plan + persist habits immediately so the day-1 loop works.
    await this.plans.generateForGoal(goal.id, {
      category: goal.category,
      goalTitle: goal.title,
      horizonDays,
      language: user.languageCode === 'en' ? 'en' : 'ru',
    });

    return this.findById(goal.id, userId);
  }

  async findById(goalId: string, userId: string) {
    const goal = await this.prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        habits: { orderBy: { position: 'asc' } },
        plan: true,
      },
    });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }

  async archive(goalId: string, userId: string) {
    const goal = await this.findById(goalId, userId);
    await this.prisma.goal.update({
      where: { id: goal.id },
      data: { status: GoalStatus.archived, archivedAt: new Date() },
    });
    return { ok: true };
  }
}
