import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';

import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot?: Bot;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    const token = envString('TELEGRAM_BOT_TOKEN', '');
    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is empty — bot disabled');
      return;
    }
    this.bot = new Bot(token);

    this.bot.command('start', async (ctx) => {
      const botUsername = envString('TELEGRAM_BOT_USERNAME', '');
      const buttonUrl = botUsername ? `https://t.me/${botUsername}/app` : undefined;
      const kb = buttonUrl
        ? new InlineKeyboard().webApp('Open AI Habit Quest', buttonUrl)
        : undefined;
      await ctx.reply(
        ctx.from?.language_code?.startsWith('ru')
          ? 'Привет! Я помогу выстроить привычки шаг за шагом. Нажми кнопку ниже, чтобы открыть приложение.'
          : 'Hi! I will help you build habits step by step. Tap the button below to open the app.',
        { reply_markup: kb },
      );
    });

    this.bot.command('help', async (ctx) => {
      await ctx.reply('Available commands: /start, /help, /feedback <text>');
    });

    this.bot.command('feedback', async (ctx) => {
      const text = ctx.match?.toString().trim();
      if (!text) {
        await ctx.reply('Send /feedback followed by your message.');
        return;
      }
      const telegramId = BigInt(ctx.from?.id ?? 0);
      const user = telegramId
        ? await this.prisma.user.findUnique({ where: { telegramId } })
        : null;
      await this.prisma.feedback.create({ data: { userId: user?.id ?? null, message: text } });
      await ctx.reply('Thanks — your feedback has been recorded.');
    });

    this.bot.catch((err) => this.logger.error(`Bot error: ${err}`));

    const webhookUrl = envString('TELEGRAM_WEBHOOK_URL', '');
    if (webhookUrl) {
      await this.bot.api.setWebhook(webhookUrl);
      this.logger.log(`Webhook set: ${webhookUrl}`);
    } else {
      void this.bot.start({
        onStart: (info) => this.logger.log(`Bot started in long-polling mode as @${info.username}`),
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) await this.bot.stop();
  }

  async sendReminder(chatId: bigint, text: string): Promise<void> {
    if (!this.bot) return;
    try {
      await this.bot.api.sendMessage(Number(chatId), text);
    } catch (err) {
      this.logger.warn(`sendReminder failed for ${chatId}: ${(err as Error).message}`);
    }
  }
}
