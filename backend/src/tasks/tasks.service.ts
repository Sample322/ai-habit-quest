import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DailyTask, GoalStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { AiPlanResponse } from '../ai/ai.types';

const XP_PER_TASK = 10;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async listToday(userId: string): Promise<DailyTask[]> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const localDate = todayLocalDate(user.timezone);

    let tasks = await this.prisma.dailyTask.findMany({
      where: { userId, localDate },
      orderBy: { createdAt: 'asc' },
    });
    if (tasks.length === 0) {
      tasks = await this.materialiseForUser(userId, localDate);
    }
    return tasks;
  }

  async toggle(userId: string, taskId: string): Promise<{ task: DailyTask; user: { streakCurrent: number; xpTotal: number; level: number } }> {
    const task = await this.prisma.dailyTask.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('Task not found');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const localToday = todayLocalDate(user.timezone);
    const localTaskDate = task.localDate.toISOString().slice(0, 10);
    const localTodayStr = localToday.toISOString().slice(0, 10);
    if (localTaskDate !== localTodayStr) {
      throw new BadRequestException('Only today\'s tasks can be toggled');
    }

    const updated = await this.prisma.dailyTask.update({
      where: { id: task.id },
      data: {
        doneAt: task.doneAt ? null : new Date(),
        xpAwarded: task.doneAt ? 0 : XP_PER_TASK,
      },
    });

    const gamification = await this.gamification.recompute(userId);

    return {
      task: updated,
      user: {
        streakCurrent: gamification.streakCurrent,
        xpTotal: gamification.xpTotal,
        level: gamification.level,
      },
    };
  }

  /**
   * Materialise the next day's tasks for a single user (used on first read and by cron).
   * Idempotent: relies on the (habitId, localDate) unique constraint.
   */
  async materialiseForUser(userId: string, localDate: Date): Promise<DailyTask[]> {
    const activeGoal = await this.prisma.goal.findFirst({
      where: { userId, status: GoalStatus.active },
      orderBy: { createdAt: 'desc' },
      include: { habits: { orderBy: { position: 'asc' } }, plan: true },
    });
    if (!activeGoal || !activeGoal.plan) return [];

    const plan = activeGoal.plan.payload as unknown as AiPlanResponse;
    const dayIndex = ((Math.floor((Date.now() - activeGoal.startedAt.getTime()) / 86_400_000)) % plan.horizonDays + plan.horizonDays) % plan.horizonDays;
    const day = plan.schedule[dayIndex] ?? plan.schedule[0];

    const habits = activeGoal.habits.slice(0, 3);
    if (habits.length === 0) return [];

    const data = habits.map((habit, idx) => ({
      userId,
      habitId: habit.id,
      localDate,
      title: day.tasks[idx] ?? habit.title,
    }));

    await this.prisma.dailyTask.createMany({ data, skipDuplicates: true });
    return this.prisma.dailyTask.findMany({
      where: { userId, localDate },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export function todayLocalDate(timezone: string): Date {
  // Compute "today" in the user's timezone, returned as a UTC date with the local Y-M-D.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return new Date(`${y}-${m}-${d}T00:00:00Z`);
}
