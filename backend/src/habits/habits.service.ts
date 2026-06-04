import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class HabitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    @Inject(forwardRef(() => TasksService))
    private readonly tasks: TasksService,
  ) {}

  async listForGoal(userId: string, goalId: string) {
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found');
    return this.prisma.habit.findMany({
      where: { goalId },
      orderBy: { position: 'asc' },
    });
  }

  async create(userId: string, goalId: string, title: string) {
    const user = await this.users.findById(userId);
    const goal = await this.prisma.goal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found');

    const clean = title?.trim();
    if (!clean || clean.length < 2) throw new BadRequestException('Habit title is too short');

    const count = await this.prisma.habit.count({ where: { goalId } });
    const limit = user.isPremium ? Infinity : this.users.freeMaxHabits();
    if (count >= limit) {
      throw new ForbiddenException({
        code: 'free_habit_limit',
        message: 'Free tier allows up to 3 habits per goal — upgrade to Premium for more.',
      });
    }

    const created = await this.prisma.habit.create({
      data: {
        userId,
        goalId,
        title: clean,
        position: count,
      },
    });
    // Z: materialise today's tasks immediately so the new habit appears on the
    // Today screen without a reload (idempotent via the (habitId, localDate)
    // unique constraint).
    try {
      await this.tasks.materialiseTodayForUser(userId);
    } catch {
      /* best-effort */
    }
    return created;
  }

  async remove(userId: string, habitId: string) {
    const habit = await this.prisma.habit.findFirst({ where: { id: habitId, userId } });
    if (!habit) throw new NotFoundException('Habit not found');
    await this.prisma.habit.delete({ where: { id: habitId } });
    return { ok: true };
  }

  /**
   * Update editable fields on a habit:
   *  - title
   *  - scheduleMask (LL): bitmask of weekdays the habit is active on
   *  - reminderEnabled / reminderHour / reminderMinute (NN)
   *
   * Validates ownership before allowing the change.
   */
  async update(
    userId: string,
    habitId: string,
    patch: {
      title?: string;
      scheduleMask?: number;
      reminderEnabled?: boolean;
      reminderHour?: number | null;
      reminderMinute?: number | null;
    },
  ) {
    const habit = await this.prisma.habit.findFirst({ where: { id: habitId, userId } });
    if (!habit) throw new NotFoundException('Habit not found');

    const data: Record<string, unknown> = {};
    if (patch.title !== undefined) {
      const clean = patch.title.trim();
      if (clean.length < 2) throw new BadRequestException('Habit title too short');
      data.title = clean;
    }
    if (patch.scheduleMask !== undefined) {
      const mask = Math.floor(patch.scheduleMask);
      if (mask < 0 || mask > 127) throw new BadRequestException('scheduleMask must be 0..127');
      data.scheduleMask = mask;
    }
    if (patch.reminderEnabled !== undefined) data.reminderEnabled = !!patch.reminderEnabled;
    if (patch.reminderHour !== undefined) {
      data.reminderHour = patch.reminderHour === null ? null : clamp(patch.reminderHour, 0, 23);
    }
    if (patch.reminderMinute !== undefined) {
      data.reminderMinute = patch.reminderMinute === null ? null : clamp(patch.reminderMinute, 0, 59);
    }

    return this.prisma.habit.update({ where: { id: habitId }, data });
  }
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return Math.floor(n);
}
