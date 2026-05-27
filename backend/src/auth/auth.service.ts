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
      parsed = verifyAndParseInitData(initData, botToken);
    } catch (err) {
      this.logger.warn(`initData rejected: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid Telegram initData');
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
