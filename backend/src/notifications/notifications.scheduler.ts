import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { todayLocalDate } from '../tasks/tasks.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
  ) {}

  // Tick once per minute and send to users whose local reminder time = current minute.
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        telegramId: true,
        timezone: true,
        languageCode: true,
        reminderHour: true,
        reminderMinute: true,
      },
    });
    const now = new Date();
    let sent = 0;
    for (const u of users) {
      if (!matchesLocalTime(now, u.timezone, u.reminderHour, u.reminderMinute)) continue;
      const localDate = todayLocalDate(u.timezone);
      const tasks = await this.prisma.dailyTask.findMany({
        where: { userId: u.id, localDate },
      });
      if (tasks.length === 0) continue;
      const allDone = tasks.every((t) => t.doneAt !== null);
      if (allDone) continue;
      const msg = u.languageCode === 'en'
        ? `Your habits for today are waiting — ${tasks.filter((t) => !t.doneAt).length} left.`
        : `Сегодняшние привычки ждут — осталось ${tasks.filter((t) => !t.doneAt).length}.`;
      await this.bot.sendReminder(u.telegramId, msg);
      sent++;
    }
    if (sent > 0) this.logger.log(`Sent ${sent} reminders`);
  }
}

function matchesLocalTime(now: Date, timezone: string, hour: number, minute: number): boolean {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return h === hour && m === minute;
}
