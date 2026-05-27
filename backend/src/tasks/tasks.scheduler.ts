import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { TasksService, todayLocalDate } from './tasks.service';

@Injectable()
export class TasksScheduler {
  private readonly logger = new Logger(TasksScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
  ) {}

  // Run every hour — for any timezone that just rolled past midnight, this materialises today's tasks.
  @Cron(CronExpression.EVERY_HOUR)
  async materialiseDailyTasks() {
    const users = await this.prisma.user.findMany({ select: { id: true, timezone: true } });
    let materialised = 0;
    for (const u of users) {
      const date = todayLocalDate(u.timezone);
      const rows = await this.tasks.materialiseForUser(u.id, date);
      if (rows.length > 0) materialised += rows.length;
    }
    if (materialised > 0) {
      this.logger.log(`Materialised ${materialised} daily tasks across users`);
    }
  }
}
