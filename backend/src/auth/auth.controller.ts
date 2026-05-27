import { Body, Controller, Post } from '@nestjs/common';
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

  @Post('telegram')
  async telegramLogin(@Body() body: TelegramLoginDto): Promise<AuthResult> {
    return this.auth.loginWithInitData(body.initData);
  }
}
