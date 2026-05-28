import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'node:crypto';

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
      const botToken = envString('TELEGRAM_WEBAPP_BOT_TOKEN');
      // Diagnostic log — safe (no secret leak): just length + 4-char prefix/suffix.
      const tokenFp = `${botToken.slice(0, 4)}…${botToken.slice(-4)} (len=${botToken.length})`;
      const initDataLen = initData?.length ?? 0;
      this.logger.log(`auth attempt: initDataLen=${initDataLen}, token=${tokenFp}`);
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

    const user = await this.prisma.user.upsert({
      where: { telegramId },
      update: {
        username: parsed.user.username ?? null,
        firstName: parsed.user.first_name ?? null,
        lastName: parsed.user.last_name ?? null,
        languageCode: normaliseLang(parsed.user.language_code),
      },
      create: {
        telegramId,
        username: parsed.user.username ?? null,
        firstName: parsed.user.first_name ?? null,
        lastName: parsed.user.last_name ?? null,
        languageCode: normaliseLang(parsed.user.language_code),
        referralCode: generateReferralCode(),
        referredById: referralStart ?? null,
      },
    });

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
}

function normaliseLang(code: string | undefined): string {
  if (!code) return 'ru';
  const short = code.slice(0, 2).toLowerCase();
  return short === 'en' ? 'en' : 'ru';
}

function generateReferralCode(): string {
  return randomBytes(6).toString('base64url');
}
