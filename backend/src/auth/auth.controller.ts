import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';

import { AuthService, AuthResult } from './auth.service';

class TelegramLoginDto {
  @IsString()
  @MinLength(10)
  initData!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Generous (mobile carriers NAT many users behind one IP) but still a cap
  // against credential-stuffing / brute-forcing the initData HMAC.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('telegram')
  async telegramLogin(@Body() body: TelegramLoginDto): Promise<AuthResult> {
    return this.auth.loginWithInitData(body.initData);
  }
}
