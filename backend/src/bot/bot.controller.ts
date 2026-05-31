import { Controller, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { BotService } from './bot.service';

/**
 * Receives Telegram webhook updates (only used when TELEGRAM_WEBHOOK_URL is set;
 * otherwise the bot runs in long-polling mode and this endpoint just acks).
 * Public + throttle-exempt: authenticity is enforced by grammy via the secret
 * token Telegram echoes in the X-Telegram-Bot-Api-Secret-Token header.
 */
@SkipThrottle()
@Controller('bot')
export class BotController {
  constructor(private readonly bot: BotService) {}

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    const handler = this.bot.getWebhookHandler();
    if (!handler) {
      // Long-polling mode (or bot disabled): ack so Telegram doesn't retry.
      res.status(200).send('ok');
      return;
    }
    await handler(req, res);
  }
}
