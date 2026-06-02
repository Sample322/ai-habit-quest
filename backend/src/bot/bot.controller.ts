import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Post,
} from '@nestjs/common';

import { BotService } from './bot.service';

/**
 * Incoming Telegram updates from the Cloudflare Worker proxy land here.
 * The Worker validates the X-Telegram-Bot-Api-Secret-Token header against
 * its own secret; we re-validate against the backend's TELEGRAM_WEBHOOK_SECRET
 * so a leaked Worker URL alone isn't enough to spoof updates.
 */
@Controller('bot')
export class BotController {
  constructor(private readonly bot: BotService) {}

  @Get('status')
  status() {
    return { mode: this.bot.modeForStatus() };
  }

  @Post('webhook')
  @HttpCode(200)
  async webhook(
    @Headers('x-telegram-bot-api-secret-token') secret: string | undefined,
    @Body() update: unknown,
  ) {
    if (!this.bot.verifyWebhookSecret(secret)) {
      throw new ForbiddenException('Invalid webhook secret');
    }
    // Fire-and-forget. grammy will swallow its own errors via bot.catch().
    // Returning fast (sync 200) prevents Telegram from retrying on slow chains.
    void this.bot.handleUpdate(update);
    return { ok: true };
  }
}
