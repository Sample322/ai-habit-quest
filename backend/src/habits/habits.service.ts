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
}
