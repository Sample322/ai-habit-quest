import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';
import { User } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';
import { verifyAndParseInitData, ParsedInitData } from './telegram-init-data';

export interface AuthResult {
  token: string;
  user: {
    id: string;
    telegramId: string;
    firstName: string | null;
    username: string | null;
    languageCode: string;
    isPremium: boolean;
  };
}

// Admins (listed in ADMIN_TELEGRAM_IDS) get Premium that effectively never
// expires. 2099 is safely below any JS Date overflow and obvious in DB.
const ADMIN_PREMIUM_UNTIL = new Date('2099-12-31T23:59:59Z');

// Referral rewards moved to tasks.service.maybeRewardInviter() — the inviter
// is now paid only AFTER the invitee completes their first task (D5 anti-abuse).
// Signup just links the relationship.

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async loginWithInitData(initData: string): Promise<AuthResult> {
    let parsed: ParsedInitData;
    try {
      // Prefer TELEGRAM_WEBAPP_BOT_TOKEN when explicitly set (lets you sign
      // WebApp data with a different bot than the one handling messages).
      // Fall back to TELEGRAM_BOT_TOKEN since in 99% of deployments they are
      // the same value — and it removes a common "Missing env var" footgun.
      const webappToken = envString('TELEGRAM_WEBAPP_BOT_TOKEN', '');
      const botToken = webappToken || envString('TELEGRAM_BOT_TOKEN');
      // Diagnostic log — safe (no secret leak): just length + 4-char prefix/suffix.
      const tokenFp = `${botToken.slice(0, 4)}…${botToken.slice(-4)} (len=${botToken.length})`;
      const initDataLen = initData?.length ?? 0;
      const tokenSource = webappToken ? 'WEBAPP' : 'BOT_TOKEN fallback';
      this.logger.log(`auth attempt: initDataLen=${initDataLen}, token=${tokenFp} [${tokenSource}]`);
      parsed = verifyAndParseInitData(initData, botToken);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.warn(`initData rejected: ${msg}`);
      // Surface the specific reason during early production so we can debug
      // misconfigured envs / wrong bot tokens / expired data from the client.
      // Tighten back to a generic message once auth is stable.
      throw new UnauthorizedException(`initData rejected: ${msg}`);
    }

    const telegramId = BigInt(parsed.user.id);
    const referralStart = parsed.startParam?.startsWith('ref_')
      ? parsed.startParam.slice(4)
      : undefined;

    const baseData = {
      username: parsed.user.username ?? null,
      firstName: parsed.user.first_name ?? null,
      lastName: parsed.user.last_name ?? null,
      languageCode: normaliseLang(parsed.user.language_code),
    };

    const existing = await this.prisma.user.findUnique({ where: { telegramId } });
    let user: User;
    if (existing) {
      user = await this.prisma.user.update({ where: { telegramId }, data: baseData });
    } else {
      user = await this.prisma.user.create({
        data: { telegramId, ...baseData, referralCode: generateReferralCode() },
      });
      // Attribute the referral and reward the inviter — only on first signup.
      // Never let a referral problem break the login flow.
      if (referralStart) {
        try {
          user = await this.applyReferral(user, referralStart);
        } catch (err) {
          this.logger.warn(`referral apply failed: ${(err as Error).message}`);
        }
      }
    }

    user = await this.applyAdminPremiumIfNeeded(user, telegramId);

    const token = await this.jwt.signAsync({ sub: user.id });

    return {
      token,
      user: {
        id: user.id,
        telegramId: user.telegramId.toString(),
        firstName: user.firstName,
        username: user.username,
        languageCode: user.languageCode,
        isPremium: user.isPremium,
      },
    };
  }

  /**
   * Link a brand-new user to the inviter identified by their referral code.
   * The +3 days Premium reward is NO LONGER granted here — see D5 anti-abuse:
   * tasks.service.maybeRewardInviter() pays the inviter only after the
   * invitee completes their first task. Safe no-op on unknown/self codes.
   */
  private async applyReferral(newUser: User, code: string): Promise<User> {
    const inviter = await this.prisma.user.findUnique({ where: { referralCode: code } });
    if (!inviter || inviter.id === newUser.id) return newUser;

    const linked = await this.prisma.user.update({
      where: { id: newUser.id },
      data: { referredById: inviter.id },
    });
    this.logger.log(`Referral linked: user ${newUser.id} → inviter ${inviter.id} (reward deferred until first task)`);
    return linked;
  }

  /**
   * If telegramId is listed in ADMIN_TELEGRAM_IDS, ensure the user has
   * Premium with the admin sentinel expiration. Idempotent — only touches
   * the DB when the state would actually change.
   */
  private async applyAdminPremiumIfNeeded(user: User, telegramId: bigint): Promise<User> {
    const adminIds = parseAdminTelegramIds(envString('ADMIN_TELEGRAM_IDS', ''));
    if (!adminIds.has(telegramId)) return user;

    const alreadyCorrect =
      user.isPremium &&
      user.premiumUntil !== null &&
      user.premiumUntil.getTime() === ADMIN_PREMIUM_UNTIL.getTime();
    if (alreadyCorrect) return user;

    this.logger.log(`Granting infinite admin Premium to telegramId=${telegramId}`);
    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        isPremium: true,
        premiumUntil: ADMIN_PREMIUM_UNTIL,
      },
    });
  }
}

function normaliseLang(code: string | undefined): string {
  if (!code) return 'ru';
  const short = code.slice(0, 2).toLowerCase();
  return short === 'en' ? 'en' : 'ru';
}

function generateReferralCode(): string {
  return randomBytes(6).toString('base64url');
}

/**
 * Parse `ADMIN_TELEGRAM_IDS` into a Set of bigint Telegram user IDs.
 * Accepts a comma-separated list of decimal numbers — e.g.
 * `888007035,123456789`. Whitespace and empty entries are tolerated.
 * Invalid entries are silently skipped so a single typo cannot lock
 * legitimate users out of auth.
 */
function parseAdminTelegramIds(raw: string): Set<bigint> {
  const out = new Set<bigint>();
  if (!raw) return out;
  for (const piece of raw.split(',')) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    try {
      out.add(BigInt(trimmed));
    } catch {
      // ignore malformed entries — we don't want a typo to lock everyone out
    }
  }
  return out;
}
