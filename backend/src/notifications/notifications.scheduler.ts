import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';
import { BotService } from '../bot/bot.service';
import { AiService } from '../ai/ai.service';
import { todayLocalDate } from '../tasks/tasks.service';

@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly ai: AiService,
  ) {}

  // Tick once per minute and send to users whose local reminder time = current minute.
  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { notifReminders: true },
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
    // Stage 1: drop users whose local minute doesn't match — typically 99%+.
    const due = users.filter((u) =>
      matchesLocalTime(now, u.timezone, u.reminderHour, u.reminderMinute),
    );
    if (due.length === 0) return;

    // Stage 2: batch DailyTask lookup for the survivors. One query instead
    // of N per-minute round-trips.
    const dueIds = due.map((u) => u.id);
    const tasks = await this.prisma.dailyTask.findMany({
      where: {
        userId: { in: dueIds },
        // The localDate column is a DATE (no time) so the user's TZ matters,
        // but for the same UTC minute users in different timezones may have
        // different "today" boundaries. Pull the union of all candidate dates
        // and dispatch per user.
      },
      select: { userId: true, localDate: true, doneAt: true },
    });
    const tasksByUser = new Map<string, { localDate: Date; doneAt: Date | null }[]>();
    for (const t of tasks) {
      const arr = tasksByUser.get(t.userId) ?? [];
      arr.push({ localDate: t.localDate, doneAt: t.doneAt });
      tasksByUser.set(t.userId, arr);
    }

    let sent = 0;
    for (const u of due) {
      const localDate = todayLocalDate(u.timezone);
      const localKey = localDate.toISOString().slice(0, 10);
      const userTasks = (tasksByUser.get(u.id) ?? []).filter(
        (t) => t.localDate.toISOString().slice(0, 10) === localKey,
      );
      if (userTasks.length === 0) continue;
      const remaining = userTasks.filter((t) => t.doneAt === null).length;
      if (remaining === 0) continue;
      const msg = u.languageCode === 'en'
        ? `Your habits for today are waiting — ${remaining} left.`
        : `Сегодняшние привычки ждут — осталось ${remaining}.`;
      try {
        await this.bot.sendReminder(u.telegramId, msg);
        sent++;
      } catch (err) {
        this.logger.warn(`reminder failed for ${u.id}: ${(err as Error).message}`);
      }
    }
    if (sent > 0) this.logger.log(`Sent ${sent} reminders`);
  }

  /**
   * NN: per-habit reminders. Fires every minute, picks every Habit whose
   * `reminderEnabled` is true and (hour, minute) matches the OWNER's current
   * local time. Skipped if the user has notifReminders globally off, the
   * habit is inactive on this weekday (LL), or its DailyTask is already done.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async perHabitTick(): Promise<void> {
    const habits = await this.prisma.habit.findMany({
      where: {
        reminderEnabled: true,
        reminderHour: { not: null },
        reminderMinute: { not: null },
        user: { notifReminders: true },
      },
      select: {
        id: true,
        title: true,
        scheduleMask: true,
        reminderHour: true,
        reminderMinute: true,
        user: { select: { id: true, telegramId: true, timezone: true, languageCode: true } },
      },
    });

    const now = new Date();
    // Filter the time + weekday match first.
    interface DueHabit { id: string; title: string; localDate: Date; userId: string; telegramId: bigint; languageCode: string }
    const due: DueHabit[] = [];
    for (const h of habits) {
      const tz = h.user.timezone;
      if (!matchesLocalTime(now, tz, h.reminderHour!, h.reminderMinute!)) continue;
      const localDate = todayLocalDate(tz);
      const dowBit = 1 << ((localDate.getUTCDay() + 6) % 7);
      if ((h.scheduleMask & dowBit) === 0) continue;
      due.push({
        id: h.id,
        title: h.title,
        localDate,
        userId: h.user.id,
        telegramId: h.user.telegramId,
        languageCode: h.user.languageCode,
      });
    }
    if (due.length === 0) return;

    // Batch the "is this habit's task already done?" check.
    const habitIds = due.map((d) => d.id);
    const doneTasks = await this.prisma.dailyTask.findMany({
      where: { habitId: { in: habitIds }, doneAt: { not: null } },
      select: { habitId: true, localDate: true },
    });
    const doneKey = new Set(
      doneTasks.map((t) => `${t.habitId}|${t.localDate.toISOString().slice(0, 10)}`),
    );

    let sent = 0;
    for (const d of due) {
      const key = `${d.id}|${d.localDate.toISOString().slice(0, 10)}`;
      if (doneKey.has(key)) continue;
      const isRu = d.languageCode !== 'en';
      const msg = isRu
        ? `⏰ Напоминание: «${d.title}». Если уже сделал — отметь в приложении.`
        : `⏰ Reminder: "${d.title}". If you already did it, tick it off in the app.`;
      try {
        await this.bot.sendReminder(d.telegramId, msg);
        sent++;
      } catch (err) {
        this.logger.warn(`per-habit reminder failed for ${d.id}: ${(err as Error).message}`);
      }
    }
    if (sent > 0) this.logger.log(`Sent ${sent} per-habit reminders`);
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

  /**
   * L: streak-break nudge. Users whose streak just transitioned to 0 get one
   * DM offering the streak-freeze. Premium users get a direct CTA; free users
   * get a Premium upsell. Fires once per break via streakBrokenNotified.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async streakBreakNudge(): Promise<void> {
    const broken = await this.prisma.user.findMany({
      where: {
        streakBrokenAt: { not: null },
        streakBrokenNotified: false,
        notifStreakBreak: true,
      },
      select: {
        id: true,
        telegramId: true,
        languageCode: true,
        isPremium: true,
        streakFreezesLeft: true,
        streakFreezesMonth: true,
      },
    });

    const month = new Date().toISOString().slice(0, 7);
    let sent = 0;
    for (const u of broken) {
      const isRu = u.languageCode !== 'en';
      const freshMonth = u.streakFreezesMonth !== month;
      const left = freshMonth ? 2 : u.streakFreezesLeft;

      let msg: string;
      if (u.isPremium && left > 0) {
        msg = isRu
          ? `🔥 Серия прервалась. У тебя ${left} заморозок этого месяца — нажми «Восстановить серию» на вкладке «Прогресс».`
          : `🔥 Streak broken. You have ${left} freeze${left === 1 ? '' : 's'} this month — tap "Restore streak" on the Progress tab.`;
      } else if (u.isPremium) {
        msg = isRu
          ? '🔥 Серия прервалась. Заморозки этого месяца уже использованы — начни новую серию завтра.'
          : '🔥 Streak broken. You\'ve used this month\'s freezes — start a new streak tomorrow.';
      } else {
        msg = isRu
          ? '🔥 Серия прервалась 😔 С Premium ты бы мог восстановить её одним нажатием. Загляни на вкладку Premium.'
          : '🔥 Streak broken 😔 With Premium you could restore it in one tap. Check the Premium tab.';
      }

      try {
        await this.bot.sendReminder(u.telegramId, msg);
        sent++;
      } catch (err) {
        this.logger.warn(`streak nudge failed for ${u.id}: ${(err as Error).message}`);
      }
      await this.prisma.user.update({
        where: { id: u.id },
        data: { streakBrokenNotified: true },
      });
    }
    if (sent > 0) this.logger.log(`Sent ${sent} streak-break nudges`);
  }

  /**
   * T: weekly recap. Monday 09:00 UTC tick — for each opted-in user whose
   * last recap was > 6 days ago, summarise the past 7 days (tasks done,
   * XP earned, current streak, current rank). One DM per user per Monday.
   */
  @Cron('0 9 * * 1', { timeZone: 'UTC' })
  async weeklyRecap(): Promise<void> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        notifWeeklyRecap: true,
        OR: [
          { lastRecapAt: null },
          { lastRecapAt: { lt: lastWeek } },
        ],
      },
      select: {
        id: true,
        telegramId: true,
        languageCode: true,
        streakCurrent: true,
        xpTotal: true,
      },
    });

    let sent = 0;
    for (const u of users) {
      const [tasksDone, weekXpAgg] = await Promise.all([
        this.prisma.dailyTask.count({
          where: { userId: u.id, doneAt: { gte: weekAgo } },
        }),
        this.prisma.dailyTask.aggregate({
          where: { userId: u.id, doneAt: { gte: weekAgo } },
          _sum: { xpAwarded: true },
        }),
      ]);
      const weekXp = weekXpAgg._sum.xpAwarded ?? 0;
      if (tasksDone === 0) {
        // Skip users with no activity — would feel like a guilt-trip DM.
        await this.prisma.user.update({ where: { id: u.id }, data: { lastRecapAt: now } });
        continue;
      }
      const ahead = await this.prisma.user.count({ where: { xpTotal: { gt: u.xpTotal } } });
      const rank = ahead + 1;

      const isRu = u.languageCode !== 'en';
      const msg = isRu
        ? `📊 Итоги недели\n\n` +
          `✅ Заданий выполнено: ${tasksDone}\n` +
          `⚡ XP получено: +${weekXp}\n` +
          `🔥 Серия: ${u.streakCurrent} дн.\n` +
          `🏆 Место: #${rank}\n\n` +
          `Хорошая неделя — продолжай в том же духе!`
        : `📊 Weekly recap\n\n` +
          `✅ Tasks done: ${tasksDone}\n` +
          `⚡ XP earned: +${weekXp}\n` +
          `🔥 Streak: ${u.streakCurrent} d\n` +
          `🏆 Rank: #${rank}\n\n` +
          `Solid week — keep it up!`;

      try {
        await this.bot.sendReminder(u.telegramId, msg);
        sent++;
      } catch (err) {
        this.logger.warn(`weekly recap failed for ${u.id}: ${(err as Error).message}`);
      }
      await this.prisma.user.update({ where: { id: u.id }, data: { lastRecapAt: now } });
    }
    if (sent > 0) this.logger.log(`Sent ${sent} weekly recaps`);
  }

  /**
   * Free-trial expiry nudge. Users whose 3-day free trial just ran out and
   * who aren't currently paying receive one DM offering the paid subscription.
   * Idempotent via trialReminderSent.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async trialExpiryNudge(): Promise<void> {
    const TRIAL_MS = 3 * 24 * 60 * 60 * 1000;
    const now = new Date();
    const cutoff = new Date(now.getTime() - TRIAL_MS);

    const expired = await this.prisma.user.findMany({
      where: {
        trialClaimedAt: { not: null, lte: cutoff },
        trialReminderSent: false,
      },
      select: { id: true, telegramId: true, languageCode: true, premiumUntil: true },
    });

    let sent = 0;
    for (const u of expired) {
      // Skip if user extended Premium through a payment in the meantime.
      if (u.premiumUntil && u.premiumUntil > now) {
        await this.prisma.user.update({ where: { id: u.id }, data: { trialReminderSent: true } });
        continue;
      }
      const isRu = u.languageCode !== 'en';
      const msg = isRu
        ? '⏳ Твой бесплатный пробный период Premium закончился. Если зашло — оформи подписку прямо в приложении, продолжай с того же уровня.'
        : '⏳ Your free Premium trial just ran out. If you liked it, grab the subscription right inside the app — pick up where you left off.';
      try {
        await this.bot.sendReminder(u.telegramId, msg);
        sent++;
      } catch (err) {
        this.logger.warn(`trial nudge failed for ${u.id}: ${(err as Error).message}`);
      }
      await this.prisma.user.update({
        where: { id: u.id },
        data: { trialReminderSent: true },
      });
    }
    if (sent > 0) this.logger.log(`Sent ${sent} trial-expiry nudges`);
  }

  /**
   * UU: Sunday 18:00 UTC — for Premium users with notifWeeklyRecap on,
   * ask ai-service for a short personalised review and DM it. Dedupe via
   * `lastAiReviewAt`. Falls back silently when ai-service is unreachable.
   */
  @Cron('0 18 * * 0', { timeZone: 'UTC' })
  async aiWeeklyReview(): Promise<void> {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const users = await this.prisma.user.findMany({
      where: {
        isPremium: true,
        notifWeeklyRecap: true,
        OR: [{ lastAiReviewAt: null }, { lastAiReviewAt: { lt: lastWeek } }],
      },
      select: {
        id: true,
        telegramId: true,
        languageCode: true,
        firstName: true,
        aiCoachingStyle: true,
        streakCurrent: true,
        streakBest: true,
      },
    });

    let sent = 0;
    for (const u of users) {
      const [tasksDone, xpAgg, topGoal] = await Promise.all([
        this.prisma.dailyTask.count({ where: { userId: u.id, doneAt: { gte: weekAgo } } }),
        this.prisma.dailyTask.aggregate({
          where: { userId: u.id, doneAt: { gte: weekAgo } },
          _sum: { xpAwarded: true },
        }),
        this.prisma.goal.findFirst({
          where: { userId: u.id, status: 'active' },
          orderBy: { createdAt: 'desc' },
          select: { title: true },
        }),
      ]);
      const weekXp = xpAgg._sum.xpAwarded ?? 0;
      if (tasksDone === 0) {
        await this.prisma.user.update({ where: { id: u.id }, data: { lastAiReviewAt: now } });
        continue;
      }

      const review = await this.ai.generateWeeklyReview({
        language: u.languageCode === 'en' ? 'en' : 'ru',
        coachingStyle: (u.aiCoachingStyle as 'gentle' | 'strict' | 'humor' | null) ?? null,
        name: u.firstName,
        weekTasksDone: tasksDone,
        weekXp,
        streakCurrent: u.streakCurrent,
        streakBest: u.streakBest,
        topGoalTitle: topGoal?.title ?? null,
      });
      if (!review) continue;

      const isRu = u.languageCode !== 'en';
      const header = isRu ? '🧠 Итоги недели от тренера' : '🧠 Weekly coach recap';
      const msg = `${header}\n\n${review.text}`;
      try {
        await this.bot.sendReminder(u.telegramId, msg);
        sent++;
      } catch (err) {
        this.logger.warn(`ai review DM failed for ${u.id}: ${(err as Error).message}`);
      }
      await this.prisma.user.update({ where: { id: u.id }, data: { lastAiReviewAt: now } });
    }
    if (sent > 0) this.logger.log(`Sent ${sent} AI weekly reviews`);
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
