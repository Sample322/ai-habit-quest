import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';

import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';
import { PaymentsService } from '../payments/payments.service';

type WebhookHandler = (req: Request, res: Response) => Promise<void>;

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot?: Bot;
  private webhookHandler?: WebhookHandler;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
  ) {}

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
      const isRu = ctx.from?.language_code?.startsWith('ru');
      // A t.me/<bot>/app deep link must be a normal URL button — `.webApp()`
      // only accepts the Mini App's own HTTPS URL and rejects t.me links with
      // 400 BUTTON_URL_INVALID. `.url()` opens the Mini App via the deep link
      // and doesn't depend on the (frequently-changing) web domain.
      const kb = buttonUrl
        ? new InlineKeyboard().url(isRu ? 'Открыть AI Habit Quest' : 'Open AI Habit Quest', buttonUrl)
        : undefined;
      await ctx.reply(
        isRu
          ? '👋 Привет! Это <b>AI Habit Quest</b> — твой геймифицированный напарник по привычкам.\n\n' +
            '• Выбираешь цель — спорт, учёба, дисциплина или своя.\n' +
            '• Получаешь 7-дневный план из маленьких шагов.\n' +
            '• Закрываешь задания — копишь XP, держишь streak.\n\n' +
            'Жми кнопку ниже, чтобы начать.'
          : '👋 Hi! This is <b>AI Habit Quest</b> — your gamified habit partner.\n\n' +
            '• Pick a goal: sport, study, discipline, or custom.\n' +
            '• Get a 7-day plan of small steps.\n' +
            '• Tick them off — earn XP, keep your streak.\n\n' +
            'Tap the button below to start.',
        { reply_markup: kb, parse_mode: 'HTML' },
      );
    });

    this.bot.command('help', async (ctx) => {
      const isRu = ctx.from?.language_code?.startsWith('ru');
      await ctx.reply(
        isRu
          ? 'Команды:\n/start — открыть Mini App\n/help — это сообщение\n/feedback <текст> — отправить фидбек'
          : 'Commands:\n/start — open Mini App\n/help — this message\n/feedback <text> — send feedback',
      );
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

    // -----------------------------------------------------------------------
    // Telegram Stars payment flow
    // -----------------------------------------------------------------------
    // 1) Pre-checkout: must approve within 10s, else Telegram cancels.
    this.bot.on('pre_checkout_query', async (ctx) => {
      try {
        await ctx.answerPreCheckoutQuery(true);
      } catch (err) {
        this.logger.warn(`pre_checkout_query failed: ${(err as Error).message}`);
      }
    });

    // 2) Successful payment: upgrade user to Premium.
    this.bot.on(':successful_payment', async (ctx) => {
      const pay = ctx.message?.successful_payment;
      const telegramId = ctx.from?.id;
      if (!pay || !telegramId) return;
      this.logger.log(
        `Stars payment: chat=${telegramId} amount=${pay.total_amount} ${pay.currency} payload=${pay.invoice_payload}`,
      );
      try {
        await this.payments.handleStarsSuccessFromBot({
          telegramId: BigInt(telegramId),
          invoicePayload: pay.invoice_payload,
          stars: pay.total_amount,
          currency: pay.currency,
          telegramPaymentChargeId: pay.telegram_payment_charge_id,
        });
        const isRu = ctx.from?.language_code?.startsWith('ru');
        await ctx.reply(
          isRu
            ? '🎉 Premium активирован. Открой Mini App — теперь у тебя безлимит целей, AI-планы на 30 дней и расширенная статистика.'
            : '🎉 Premium activated. Open the Mini App — unlimited goals, 30-day AI plans and advanced stats are now yours.',
        );
      } catch (err) {
        this.logger.error(`Failed to apply Stars payment: ${(err as Error).message}`);
        await ctx.reply(
          'Платёж получен, но активация Premium не сработала. Напиши /feedback — разберёмся.',
        );
      }
    });

    this.bot.catch((err) => this.logger.error(`Bot error: ${err}`));

    const webhookUrl = envString('TELEGRAM_WEBHOOK_URL', '');
    const bot = this.bot;
    if (webhookUrl) {
      // Webhook mode. CRITICAL: do NOT await Telegram round-trips here — this
      // runs inside onModuleInit, which blocks app.listen(). A slow/failing
      // bot.init()/setWebhook would stop the port from binding and fail the
      // platform healthcheck. Set it up detached; the handler comes online a
      // moment later and drop_pending_updates covers the brief gap.
      const secretToken = this.webhookSecretToken(token);
      void (async () => {
        try {
          await bot.init();
          this.webhookHandler = webhookCallback(bot, 'express', { secretToken });
          await bot.api.setWebhook(webhookUrl, {
            secret_token: secretToken,
            drop_pending_updates: true,
          });
          this.logger.log(`Bot started in webhook mode as @${bot.botInfo.username} -> ${webhookUrl}`);
        } catch (err) {
          this.logger.error(`Webhook setup failed: ${(err as Error).message}`);
        }
      })();
    } else {
      // Default: long-polling. Safe and simple for a single instance.
      void bot.start({
        onStart: (info) => this.logger.log(`Bot started in long-polling mode as @${info.username}`),
      });
    }
  }

  /** Express handler for incoming Telegram updates, or undefined in long-polling mode. */
  getWebhookHandler(): WebhookHandler | undefined {
    return this.webhookHandler;
  }

  /** Deterministic per-bot secret for the Telegram webhook (no extra env needed). */
  private webhookSecretToken(botToken: string): string {
    return createHash('sha256').update(`ahq-webhook:${botToken}`).digest('hex');
  }

  async onModuleDestroy(): Promise<void> {
    // bot.stop() applies to long-polling; in webhook mode there's nothing to stop.
    if (this.bot && !this.webhookHandler) await this.bot.stop();
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
