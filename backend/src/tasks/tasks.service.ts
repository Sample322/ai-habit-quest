import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DailyTask, Goal, GoalStatus, Habit, Plan } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { GamificationService } from '../gamification/gamification.service';
import { AiPlanResponse } from '../ai/ai.types';
import { computeAchievements, type AchievementView } from '../gamification/progress-extras';

const XP_PER_TASK = 10;
const MS_PER_DAY = 86_400_000;

type GoalWithPlanAndHabits = Goal & {
  habits: Habit[];
  plan: Plan | null;
};

type DailyTaskWithRelations = DailyTask & {
  habit: Habit & { goal: Goal };
};

export interface DailyTaskView {
  id: string;
  habitId: string;
  goalId: string;
  goalTitle: string;
  title: string;
  doneAt: string | null;
  xpAwarded: number;
  localDate: string;
  createdAt: string;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamification: GamificationService,
  ) {}

  async listToday(userId: string): Promise<DailyTaskView[]> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const localDate = todayLocalDate(user.timezone);

    let rows = await this.fetchTodayRows(userId, localDate);
    if (rows.length === 0) {
      await this.materialiseForUser(userId, localDate);
      rows = await this.fetchTodayRows(userId, localDate);
    }
    return rows.map(toTaskView);
  }

  async toggle(
    userId: string,
    taskId: string,
  ): Promise<{
    task: DailyTaskView;
    user: { streakCurrent: number; xpTotal: number; level: number };
    newAchievements: AchievementView[];
  }> {
    const task = await this.prisma.dailyTask.findFirst({ where: { id: taskId, userId } });
    if (!task) throw new NotFoundException('Task not found');

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const localToday = todayLocalDate(user.timezone);
    const localTaskDate = task.localDate.toISOString().slice(0, 10);
    const localTodayStr = localToday.toISOString().slice(0, 10);
    if (localTaskDate !== localTodayStr) {
      throw new BadRequestException("Only today's tasks can be toggled");
    }

    // Snapshot earned achievements BEFORE the change so we can report any that
    // become newly earned (only meaningful when marking done, not undo).
    const markingDone = !task.doneAt;
    const lang = user.languageCode === 'en' ? 'en' : 'ru';
    const earnedBefore = markingDone
      ? new Set((await this.computeUserAchievements(userId, lang)).filter((a) => a.earned).map((a) => a.code))
      : new Set<string>();

    await this.prisma.dailyTask.update({
      where: { id: task.id },
      data: {
        doneAt: task.doneAt ? null : new Date(),
        xpAwarded: task.doneAt ? 0 : XP_PER_TASK,
      },
    });

    // Referral rewards moved to goals.service.createForUser (first goal trigger).

    let newAchievements: AchievementView[] = [];
    if (markingDone) {
      // Compute achievements BEFORE recompute so we can persist UserBadge rows
      // and let recompute pick up their bonus XP in this same pass.
      const after = await this.computeUserAchievements(userId, lang);
      newAchievements = after.filter((a) => a.earned && !earnedBefore.has(a.code));
      if (newAchievements.length > 0) {
        await this.persistEarnedBadges(userId, newAchievements);
      }
    }

    const gamification = await this.gamification.recompute(userId);

    const updated = await this.prisma.dailyTask.findUniqueOrThrow({
      where: { id: task.id },
      include: { habit: { include: { goal: true } } },
    });

    return {
      task: toTaskView(updated),
      user: {
        streakCurrent: gamification.streakCurrent,
        xpTotal: gamification.xpTotal,
        level: gamification.level,
      },
      newAchievements,
    };
  }

  /**
   * Persist newly-earned achievements as UserBadge rows. Idempotent — re-runs
   * skip via the unique (userId, badgeId) PK. The Badge row is upserted lazily
   * so we don't need a seed migration.
   */
  private async persistEarnedBadges(userId: string, achievements: AchievementView[]): Promise<void> {
    for (const a of achievements) {
      const badge = await this.prisma.badge.upsert({
        where: { code: a.code },
        update: {},
        create: {
          code: a.code,
          title: a.title,
          description: a.description,
          iconKey: a.icon,
        },
      });
      await this.prisma.userBadge.upsert({
        where: { userId_badgeId: { userId, badgeId: badge.id } },
        update: {},
        create: { userId, badgeId: badge.id },
      });
    }
  }

  /** Recompute the user's derived achievements from current stats. */
  private async computeUserAchievements(userId: string, lang: 'ru' | 'en'): Promise<AchievementView[]> {
    const [u, completedTasks, goals, referrals] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { xpTotal: true, streakBest: true } }),
      this.prisma.dailyTask.count({ where: { userId, doneAt: { not: null } } }),
      this.prisma.goal.count({ where: { userId } }),
      this.prisma.user.count({ where: { referredById: userId } }),
    ]);
    return computeAchievements(
      { xpTotal: u.xpTotal, streakBest: u.streakBest, completedTasks, goals, referrals },
      lang,
    );
  }

  /**
   * Convenience wrapper that resolves the user's timezone and calls
   * `materialiseForUser` for "today". Call this right after a new goal is
   * created so its tasks show up in the Today view immediately, even when
   * other goals already materialised the day's tasks earlier.
   */
  async materialiseTodayForUser(userId: string): Promise<number> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true },
    });
    return this.materialiseForUser(userId, todayLocalDate(user.timezone));
  }

  /**
   * Materialise today's tasks across ALL of the user's active goals.
   *
   * Premium users can hold multiple active goals simultaneously; each goal
   * contributes its (up to 3) habits as separate daily tasks. The
   * `(habitId, localDate)` unique constraint makes the operation idempotent
   * if called multiple times on the same day.
   */
  async materialiseForUser(userId: string, localDate: Date): Promise<number> {
    const activeGoals = await this.prisma.goal.findMany({
      where: { userId, status: GoalStatus.active },
      orderBy: { createdAt: 'asc' },
      include: {
        habits: { orderBy: { position: 'asc' } },
        plan: true,
      },
    });

    const inserts: { userId: string; habitId: string; localDate: Date; title: string }[] = [];
    for (const goal of activeGoals) {
      inserts.push(...buildDailyTaskInserts(userId, goal, localDate));
    }
    if (inserts.length === 0) return 0;

    const result = await this.prisma.dailyTask.createMany({
      data: inserts,
      skipDuplicates: true,
    });
    return result.count;
  }

  private fetchTodayRows(userId: string, localDate: Date): Promise<DailyTaskWithRelations[]> {
    return this.prisma.dailyTask.findMany({
      where: { userId, localDate },
      orderBy: { createdAt: 'asc' },
      include: { habit: { include: { goal: true } } },
    });
  }
}

function buildDailyTaskInserts(
  userId: string,
  goal: GoalWithPlanAndHabits,
  localDate: Date,
): { userId: string; habitId: string; localDate: Date; title: string }[] {
  if (!goal.plan) return [];
  const plan = goal.plan.payload as unknown as AiPlanResponse;
  if (!plan?.schedule?.length) return [];

  const dayIndex = computeDayIndex(goal.startedAt, plan.horizonDays);
  const day = plan.schedule[dayIndex] ?? plan.schedule[0];
  const habits = goal.habits.slice(0, 3);
  if (habits.length === 0) return [];

  return habits.map((habit, idx) => ({
    userId,
    habitId: habit.id,
    localDate,
    title: day.tasks[idx] ?? habit.title,
  }));
}

function toTaskView(row: DailyTaskWithRelations): DailyTaskView {
  return {
    id: row.id,
    habitId: row.habitId,
    goalId: row.habit.goalId,
    goalTitle: row.habit.goal.title,
    title: row.title,
    doneAt: row.doneAt ? row.doneAt.toISOString() : null,
    xpAwarded: row.xpAwarded,
    localDate: row.localDate.toISOString().slice(0, 10),
    createdAt: row.createdAt.toISOString(),
  };
}

function computeDayIndex(startedAt: Date, horizonDays: number): number {
  if (horizonDays <= 0) return 0;
  const offsetDays = Math.floor((Date.now() - startedAt.getTime()) / MS_PER_DAY);
  return ((offsetDays % horizonDays) + horizonDays) % horizonDays;
}

export function todayLocalDate(timezone: string): Date {
  // Compute "today" in the user's timezone, returned as a UTC date with the local Y-M-D.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  const d = parts.find((p) => p.type === 'day')!.value;
  return new Date(`${y}-${m}-${d}T00:00:00Z`);
}
