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

  /**
   * Once an hour, find invitees whose 3-day welcome Premium has just expired,
   * haven't received the upsell DM yet, and aren't currently paying for
   * Premium — DM them one nudge about subscribing. Idempotent via the
   * referralGiftReminderSent flag.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async giftExpiryNudge(): Promise<void> {
    const GIFT_MS = 3 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - GIFT_MS);

    const expired = await this.prisma.user.findMany({
      where: {
        referralGiftClaimedAt: { not: null, lte: cutoff },
        referralGiftReminderSent: false,
      },
      select: { id: true, telegramId: true, languageCode: true, premiumUntil: true },
    });

    let sent = 0;
    for (const u of expired) {
      // Skip if user is currently Premium (gift extended via payment, or admin).
      if (u.premiumUntil && u.premiumUntil > now) {
        await this.prisma.user.update({ where: { id: u.id }, data: { referralGiftReminderSent: true } });
        continue;
      }
      const isRu = u.languageCode !== 'en';
      const msg = isRu
        ? '🎁 Твой подарочный Premium закончился. Понравилось? Открой приложение и оформи подписку — план на 30 дней, AI-коучинг, восстановление серии.'
        : '🎁 Your welcome Premium has expired. Liked it? Open the app and subscribe — 30-day plans, AI coaching, streak freeze.';
      try {
        await this.bot.sendReminder(u.telegramId, msg);
        sent++;
      } catch (err) {
        this.logger.warn(`gift nudge failed for ${u.id}: ${(err as Error).message}`);
      }
      await this.prisma.user.update({
        where: { id: u.id },
        data: { referralGiftReminderSent: true },
      });
    }
    if (sent > 0) this.logger.log(`Sent ${sent} gift-expiry nudges`);
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
