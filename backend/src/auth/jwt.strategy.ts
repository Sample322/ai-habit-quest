import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';

export interface JwtPayload {
  sub: string;
}

export interface AuthenticatedUser {
  id: string;
  telegramId: bigint;
  isPremium: boolean;
  languageCode: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: envString('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('User not found');
    return {
      id: user.id,
      telegramId: user.telegramId,
      isPremium: user.isPremium,
      languageCode: user.languageCode,
    };
  }
}
