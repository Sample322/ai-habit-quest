import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { envNumber } from '../config/env';
import { isAdminTelegramId } from '../admin/is-admin';
import { computeAchievements } from '../gamification/progress-extras';
import { computeCosmetics } from '../gamification/cosmetics';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  freeMaxGoals(): number {
    return envNumber('FREE_MAX_GOALS', 1);
  }

  freeMaxHabits(): number {
    return envNumber('FREE_MAX_HABITS', 3);
  }

  freePlanHorizon(): number {
    return envNumber('FREE_PLAN_HORIZON_DAYS', 7);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getProfile(id: string) {
    const u = await this.findById(id);
    const [referralCount, completedTasks, goalsCount] = await Promise.all([
      this.prisma.user.count({ where: { referredById: id } }),
      this.prisma.dailyTask.count({ where: { userId: id, doneAt: { not: null } } }),
      this.prisma.goal.count({ where: { userId: id } }),
    ]);
    const lang = u.languageCode === 'en' ? 'en' : 'ru';
    const achievements = computeAchievements(
      {
        xpTotal: u.xpTotal,
        streakBest: u.streakBest,
        completedTasks,
        goals: goalsCount,
        referrals: referralCount,
      },
      lang,
    );
    const earnedCodes = new Set(achievements.filter((a) => a.earned).map((a) => a.code));
    const cosmetics = computeCosmetics(
      { level: u.level, isPremium: u.isPremium, earnedAchievementCodes: earnedCodes },
      lang,
    );

    return {
      id: u.id,
      telegramId: u.telegramId.toString(),
      firstName: u.firstName,
      username: u.username,
      languageCode: u.languageCode,
      timezone: u.timezone,
      reminder: { hour: u.reminderHour, minute: u.reminderMinute },
      isPremium: u.isPremium,
      isAdmin: isAdminTelegramId(u.telegramId),
      premiumUntil: u.premiumUntil,
      streak: { current: u.streakCurrent, best: u.streakBest, freezesLeft: u.streakFreezesLeft },
      xpTotal: u.xpTotal,
      level: u.level,
      referralCode: u.referralCode,
      referralCount,
      cosmetics,
      limits: {
        maxGoals: u.isPremium ? null : this.freeMaxGoals(),
        maxHabits: u.isPremium ? null : this.freeMaxHabits(),
        planHorizonDays: u.isPremium ? 30 : this.freePlanHorizon(),
      },
    };
  }

  async updatePreferences(
    id: string,
    prefs: { languageCode?: string; timezone?: string; reminderHour?: number; reminderMinute?: number },
  ) {
    const data: Record<string, unknown> = {};
    if (prefs.languageCode) data['languageCode'] = prefs.languageCode === 'en' ? 'en' : 'ru';
    if (prefs.timezone) data['timezone'] = prefs.timezone;
    if (prefs.reminderHour !== undefined) data['reminderHour'] = clamp(prefs.reminderHour, 0, 23);
    if (prefs.reminderMinute !== undefined) data['reminderMinute'] = clamp(prefs.reminderMinute, 0, 59);
    await this.prisma.user.update({ where: { id }, data });
    return this.getProfile(id);
  }
}

function clamp(n: number, min: number, max: number): number {
  if (n < min) return min;
  if (n > max) return max;
  return Math.floor(n);
}
