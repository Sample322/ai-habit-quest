import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';

const LEAGUE_SIZE = 30;
const PROMOTE_COUNT = 7;
const DEMOTE_COUNT = 5;
const MAX_TIER = 4; // 0=Bronze, 1=Silver, 2=Gold, 3=Platinum, 4=Diamond
const TIER_NAMES_RU = ['Бронза', 'Серебро', 'Золото', 'Платина', 'Алмаз'];
const TIER_NAMES_EN = ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
const TIER_ICONS = ['🥉', '🥈', '🥇', '💎', '👑'];

export interface LeaguesMe {
  league: {
    id: string;
    tier: number;
    tierName: string;
    tierIcon: string;
    weekStart: string;
    weekEnd: string;
    daysLeft: number;
  };
  myRank: number;
  myWeeklyXp: number;
  members: {
    position: number;
    id: string;
    name: string;
    weeklyXp: number;
    streak: number;
    level: number;
    isMe: boolean;
  }[];
  promoteCount: number;
  demoteCount: number;
}

@Injectable()
export class LeaguesService {
  private readonly logger = new Logger(LeaguesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get (or create) the caller's league for the current week. Lazy assignment:
   * if the user has no league this week, pick the lowest open tier from history
   * (default Bronze 0) and slot them in.
   */
  async leaguesMe(userId: string, lang: 'ru' | 'en'): Promise<LeaguesMe> {
    const weekStart = currentWeekStart();

    let member = await this.prisma.leagueMember.findFirst({
      where: { userId, league: { weekStart } },
      include: { league: true },
    });

    if (!member) {
      // Pick previous tier (so promotions/demotions carry over), default Bronze 0.
      const prevWeek = new Date(weekStart);
      prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);
      const prev = await this.prisma.leagueMember.findFirst({
        where: { userId, league: { weekStart: prevWeek } },
        include: { league: true },
      });
      const targetTier = prev?.league.tier ?? 0;

      const league = await this.findOrCreateOpenLeague(weekStart, targetTier);
      // Compute weeklyXp baseline: XP earned this week so far.
      const weeklyXp = await this.computeWeeklyXp(userId, weekStart);
      member = await this.prisma.leagueMember.create({
        data: { leagueId: league.id, userId, weeklyXp },
        include: { league: true },
      });
    } else {
      // Refresh weeklyXp on each read so the standings stay live without a cron.
      const weeklyXp = await this.computeWeeklyXp(userId, weekStart);
      if (weeklyXp !== member.weeklyXp) {
        member = await this.prisma.leagueMember.update({
          where: { id: member.id },
          data: { weeklyXp },
          include: { league: true },
        });
      }
    }

    // Refresh weeklyXp for ALL members of the league so the board is honest.
    await this.refreshLeagueWeeklyXp(member.leagueId, weekStart);

    const members = await this.prisma.leagueMember.findMany({
      where: { leagueId: member.leagueId },
      orderBy: [{ weeklyXp: 'desc' }, { joinedAt: 'asc' }],
      include: { user: { select: { firstName: true, username: true, streakCurrent: true, level: true } } },
    });

    const myIdx = members.findIndex((m) => m.userId === userId);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((weekEnd.getTime() + 86_400_000 - now.getTime()) / 86_400_000));

    return {
      league: {
        id: member.league.id,
        tier: member.league.tier,
        tierName: (lang === 'en' ? TIER_NAMES_EN : TIER_NAMES_RU)[member.league.tier],
        tierIcon: TIER_ICONS[member.league.tier],
        weekStart: weekStart.toISOString().slice(0, 10),
        weekEnd: weekEnd.toISOString().slice(0, 10),
        daysLeft,
      },
      myRank: myIdx + 1,
      myWeeklyXp: member.weeklyXp,
      members: members.map((m, i) => ({
        position: i + 1,
        id: m.userId,
        name: m.user.firstName || m.user.username || (lang === 'en' ? 'Player' : 'Игрок'),
        weeklyXp: m.weeklyXp,
        streak: m.user.streakCurrent,
        level: m.user.level,
        isMe: m.userId === userId,
      })),
      promoteCount: PROMOTE_COUNT,
      demoteCount: DEMOTE_COUNT,
    };
  }

  /**
   * Sunday 23:55 UTC — close the week. Top PROMOTE_COUNT go up a tier, bottom
   * DEMOTE_COUNT go down. Members keep nothing else; the next read lazily
   * places them in a fresh league of the new tier.
   *
   * Carry-over is implicit: leaguesMe() reads previous week's tier when no
   * current-week membership exists. So the cron just needs to mark promotions
   * and demotions in the previous week's records via a "carry tier" delta —
   * we store it by updating the previous member's leagueId? No — simpler:
   * write outcome to a sentinel by adjusting tier on the user's NEXT league
   * lazily in leaguesMe(). Here we keep the cron minimal and only log.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async closeWeekIfDue(): Promise<void> {
    const now = new Date();
    // Only run once shortly after Monday 00:00 UTC.
    if (now.getUTCDay() !== 1 || now.getUTCHours() !== 0) return;

    const prevWeek = new Date(currentWeekStart());
    prevWeek.setUTCDate(prevWeek.getUTCDate() - 7);

    const leagues = await this.prisma.league.findMany({ where: { weekStart: prevWeek } });
    let promoted = 0;
    let demoted = 0;
    for (const lg of leagues) {
      const members = await this.prisma.leagueMember.findMany({
        where: { leagueId: lg.id },
        orderBy: [{ weeklyXp: 'desc' }, { joinedAt: 'asc' }],
      });
      // Synthesize next-week placement by carrying their target tier in a
      // virtual record on prevWeek — the simplest way without extra columns:
      // we just leave the lazy slot logic in leaguesMe() to default to prev tier.
      // For promotions/demotions, we slot the user into next week's correct tier
      // proactively here so the read path is consistent.
      const nextWeek = currentWeekStart();
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        let targetTier = lg.tier;
        if (i < PROMOTE_COUNT) targetTier = Math.min(MAX_TIER, lg.tier + 1);
        else if (i >= members.length - DEMOTE_COUNT) targetTier = Math.max(0, lg.tier - 1);

        const exists = await this.prisma.leagueMember.findFirst({
          where: { userId: m.userId, league: { weekStart: nextWeek } },
        });
        if (exists) continue;

        const target = await this.findOrCreateOpenLeague(nextWeek, targetTier);
        await this.prisma.leagueMember.create({
          data: { leagueId: target.id, userId: m.userId, weeklyXp: 0 },
        });
        if (targetTier > lg.tier) promoted++;
        else if (targetTier < lg.tier) demoted++;
      }
    }
    this.logger.log(`League rotation closed: ${leagues.length} leagues, ↑${promoted} ↓${demoted}`);
  }

  private async findOrCreateOpenLeague(weekStart: Date, tier: number) {
    const candidates = await this.prisma.league.findMany({
      where: { weekStart, tier },
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const open = candidates.find((c) => c._count.members < LEAGUE_SIZE);
    if (open) return open;
    return this.prisma.league.create({ data: { weekStart, tier } });
  }

  private async computeWeeklyXp(userId: string, weekStart: Date): Promise<number> {
    const agg = await this.prisma.dailyTask.aggregate({
      where: { userId, doneAt: { gte: weekStart } },
      _sum: { xpAwarded: true },
    });
    return agg._sum.xpAwarded ?? 0;
  }

  private async refreshLeagueWeeklyXp(leagueId: string, weekStart: Date): Promise<void> {
    const members = await this.prisma.leagueMember.findMany({ where: { leagueId } });
    for (const m of members) {
      const xp = await this.computeWeeklyXp(m.userId, weekStart);
      if (xp !== m.weeklyXp) {
        await this.prisma.leagueMember.update({ where: { id: m.id }, data: { weeklyXp: xp } });
      }
    }
  }
}

/** Monday 00:00 UTC of the current week, returned as a UTC Date with that Y-M-D. */
function currentWeekStart(): Date {
  const now = new Date();
  const dow = now.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}
