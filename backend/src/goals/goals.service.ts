import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Goal, GoalCategory, GoalStatus, Habit } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { PlansService } from '../plans/plans.service';
import { TasksService } from '../tasks/tasks.service';
import { GamificationService } from '../gamification/gamification.service';

export interface CreateGoalInput {
  title: string;
  category: GoalCategory;
}

export interface GoalView extends Goal {
  habits: Habit[];
}

export interface DeletionPreview {
  goalId: string;
  goalTitle: string;
  completedTasks: number;
  pendingTasks: number;
  xpToLose: number;
}

export interface DeletionResult {
  deletedGoalId: string;
  goalTitle: string;
  xpLost: number;
  user: {
    streakCurrent: number;
    streakBest: number;
    xpTotal: number;
    level: number;
  };
}

export interface GoalInsights {
  goalId: string;
  goalTitle: string;
  horizonDays: number;
  dayIndex: number;             // 1-based day-of-plan; capped at horizonDays
  daysSinceStart: number;
  completedAllTime: number;
  totalAllTime: number;
  completionPct: number;
  heatmap: { date: string; total: number; done: number }[];  // last 30 days (oldest first)
}

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly plans: PlansService,
    private readonly tasks: TasksService,
    private readonly gamification: GamificationService,
  ) {}

  async listForUser(userId: string): Promise<GoalView[]> {
    return this.prisma.goal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { habits: { orderBy: { position: 'asc' } } },
    });
  }

  async createForUser(userId: string, input: CreateGoalInput): Promise<GoalView> {
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

    // Force materialisation of today's tasks for THIS goal. Without this, a
    // 4th goal created after the day's first /tasks/today call would stay
    // invisible until the hourly scheduler runs — which is the bug we just hit.
    await this.tasks.materialiseTodayForUser(userId);

    return this.findById(goal.id, userId);
  }

  async findById(goalId: string, userId: string): Promise<GoalView & { plan: unknown }> {
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

  /**
   * Preview the gamification cost of deleting a goal — so the UI can show
   * the user a meaningful confirmation prompt before they commit.
   */
  async previewDeletion(goalId: string, userId: string): Promise<DeletionPreview> {
    const goal = await this.findGoalOrThrow(goalId, userId);
    const taskAgg = await this.prisma.dailyTask.findMany({
      where: { userId, habit: { goalId } },
      select: { xpAwarded: true, doneAt: true },
    });
    let completedTasks = 0;
    let xpToLose = 0;
    for (const t of taskAgg) {
      if (t.doneAt) {
        completedTasks++;
        xpToLose += t.xpAwarded;
      }
    }
    return {
      goalId: goal.id,
      goalTitle: goal.title,
      completedTasks,
      pendingTasks: taskAgg.length - completedTasks,
      xpToLose,
    };
  }

  /**
   * Hard-delete a goal. Cascades through Prisma onDelete: Cascade rules
   * (Goal → Habit → DailyTask, Goal → Plan), then recomputes streak/XP/level
   * from the user's remaining DailyTask history so the gamification state
   * stays internally consistent.
   *
   * The xp that disappears with the goal's tasks is the natural penalty —
   * we don't subtract anything extra on top of that. The returned `xpLost`
   * is the delta the client should expect to see in the user header.
   */
  async deleteGoal(goalId: string, userId: string): Promise<DeletionResult> {
    const before = await this.previewDeletion(goalId, userId);

    await this.prisma.goal.delete({ where: { id: before.goalId } });

    const stats = await this.gamification.recompute(userId);

    this.logger.log(
      `Goal deleted goalId=${before.goalId} title="${before.goalTitle}" xpLost=${before.xpToLose} newXpTotal=${stats.xpTotal}`,
    );

    return {
      deletedGoalId: before.goalId,
      goalTitle: before.goalTitle,
      xpLost: before.xpToLose,
      user: stats,
    };
  }

  /**
   * Regenerate the AI plan for an existing goal (e.g. when the first attempt
   * fell back to the stub). Replaces the plan + habits, re-materialises today's
   * tasks, and recomputes gamification so XP/streak stay consistent after the
   * old tasks are cascaded away. If the AI is busy (stub), nothing is changed.
   */
  async regeneratePlan(goalId: string, userId: string): Promise<GoalView & { plan: unknown }> {
    const goal = await this.findGoalOrThrow(goalId, userId);
    const user = await this.users.findById(userId);

    await this.plans.regenerateForGoal(goal.id, {
      category: goal.category,
      goalTitle: goal.title,
      horizonDays: goal.horizonDays,
      language: user.languageCode === 'en' ? 'en' : 'ru',
    });

    await this.tasks.materialiseTodayForUser(userId);
    await this.gamification.recompute(userId);

    this.logger.log(`Plan regenerated for goalId=${goalId} title="${goal.title}"`);
    return this.findById(goalId, userId);
  }

  /**
   * Per-goal insights: 30-day heatmap of task completion + day X of horizon +
   * all-time completion %. Pure read aggregate; doesn't touch any state.
   */
  async insights(goalId: string, userId: string): Promise<GoalInsights> {
    const goal = await this.findGoalOrThrow(goalId, userId);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const since = new Date(today);
    since.setUTCDate(today.getUTCDate() - 29); // 30-day window inclusive

    const rows = await this.prisma.dailyTask.findMany({
      where: { userId, habit: { goalId }, localDate: { gte: since } },
      select: { localDate: true, doneAt: true },
    });

    const byDate = new Map<string, { total: number; done: number }>();
    for (const r of rows) {
      const k = r.localDate.toISOString().slice(0, 10);
      const e = byDate.get(k) ?? { total: 0, done: 0 };
      e.total++;
      if (r.doneAt) e.done++;
      byDate.set(k, e);
    }
    const heatmap: GoalInsights['heatmap'] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const k = d.toISOString().slice(0, 10);
      const e = byDate.get(k) ?? { total: 0, done: 0 };
      heatmap.push({ date: k, total: e.total, done: e.done });
    }

    const allTime = await this.prisma.dailyTask.findMany({
      where: { userId, habit: { goalId } },
      select: { doneAt: true },
    });
    const completedAllTime = allTime.filter((r) => r.doneAt !== null).length;
    const totalAllTime = allTime.length;
    const completionPct =
      totalAllTime === 0 ? 0 : Math.round((completedAllTime / totalAllTime) * 100);

    const MS_PER_DAY = 86_400_000;
    const daysSinceStart = Math.max(0, Math.floor((Date.now() - goal.startedAt.getTime()) / MS_PER_DAY));
    const dayIndex = Math.min(daysSinceStart + 1, goal.horizonDays);

    return {
      goalId: goal.id,
      goalTitle: goal.title,
      horizonDays: goal.horizonDays,
      dayIndex,
      daysSinceStart,
      completedAllTime,
      totalAllTime,
      completionPct,
      heatmap,
    };
  }

  private async findGoalOrThrow(goalId: string, userId: string): Promise<Goal> {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found');
    return goal;
  }
}
