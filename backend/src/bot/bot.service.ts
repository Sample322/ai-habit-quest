import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { Bot, InlineKeyboard } from 'grammy';

import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot?: Bot;
  private mode: 'webhook' | 'long-polling' | 'disabled' = 'disabled';

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

    // Route all Telegram API calls through the Cloudflare Worker proxy when
    // TELEGRAM_API_ROOT is set. This fixes the RU-host → api.telegram.org
    // connectivity flap. Defaults to direct Telegram API for local dev.
    const apiRoot = envString('TELEGRAM_API_ROOT', '').replace(/\/+$/, '');
    this.bot = new Bot(token, apiRoot ? { client: { apiRoot } } : {});
    if (apiRoot) this.logger.log(`Telegram apiRoot=${apiRoot}`);

    this.bot.command('start', async (ctx) => {
      const botUsername = envString('TELEGRAM_BOT_USERNAME', '');
      const isRu = ctx.from?.language_code?.startsWith('ru');

      // /start payload — set when user follows a deep link like
      // t.me/<bot>?start=ref_<code>. We forward that payload to the Mini App
      // via startapp so auth.service applyReferral() can link the inviter.
      const payload = ctx.match?.toString().trim() ?? '';
      const isReferral = payload.startsWith('ref_');
      const startapp = isReferral ? payload : 'start';

      const buttonUrl = botUsername
        ? `https://t.me/${botUsername}?startapp=${encodeURIComponent(startapp)}`
        : undefined;
      const kb = buttonUrl
        ? new InlineKeyboard().url(
            isRu ? '🚀 Открыть AI Habit Quest' : '🚀 Open AI Habit Quest',
            buttonUrl,
          )
        : undefined;

      const text = isReferral
        ? isRu
          ? '🎁 <b>Тебя пригласили в AI Habit Quest!</b>\n\n' +
            'Создай свою первую цель и получи <b>+3 дня Premium в подарок</b>.\n\n' +
            '• AI собирает 30-дневный план привычек\n' +
            '• Серии, XP, лиги, сезонные награды\n' +
            '• Восстановление streak, расширенная аналитика\n\n' +
            'Жми кнопку ниже — приглашение применится автоматически.'
          : '🎁 <b>You\'ve been invited to AI Habit Quest!</b>\n\n' +
            'Create your first goal and get <b>+3 days of Premium</b> as a welcome gift.\n\n' +
            '• AI builds a 30-day habit plan\n' +
            '• Streaks, XP, leagues, season rewards\n' +
            '• Streak freeze, advanced stats\n\n' +
            'Tap the button — the invite applies automatically.'
        : isRu
          ? '👋 Привет! Это <b>AI Habit Quest</b> — твой геймифицированный напарник по привычкам.\n\n' +
            '• Выбираешь цель — спорт, учёба, дисциплина или своя.\n' +
            '• Получаешь 7-дневный план из маленьких шагов.\n' +
            '• Закрываешь задания — копишь XP, держишь streak.\n\n' +
            'Жми кнопку ниже, чтобы начать.'
          : '👋 Hi! This is <b>AI Habit Quest</b> — your gamified habit partner.\n\n' +
            '• Pick a goal: sport, study, discipline, or custom.\n' +
            '• Get a 7-day plan of small steps.\n' +
            '• Tick them off — earn XP, keep your streak.\n\n' +
            'Tap the button below to start.';

      await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
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
    this.bot.on('pre_checkout_query', async (ctx) => {
      try {
        await ctx.answerPreCheckoutQuery(true);
      } catch (err) {
        this.logger.warn(`pre_checkout_query failed: ${(err as Error).message}`);
      }
    });

    this.bot.on(':successful_payment', async (ctx) => {
      const pay = ctx.message?.successful_payment;
      const telegramId = ctx.from?.id;
      if (!pay || !telegramId) return;
      this.logger.log(
        `Payment: chat=${telegramId} amount=${pay.total_amount} ${pay.currency} payload=${pay.invoice_payload}`,
      );
      try {
        // Route by currency: XTR → Stars handler, RUB (and others via card) →
        // card handler. Both upgrade the user; we keep separate paths for
        // analytics + provider-specific charge metadata.
        if (pay.currency === 'XTR') {
          await this.payments.handleStarsSuccessFromBot({
            telegramId: BigInt(telegramId),
            invoicePayload: pay.invoice_payload,
            stars: pay.total_amount,
            currency: pay.currency,
            telegramPaymentChargeId: pay.telegram_payment_charge_id,
          });
        } else {
          await this.payments.handleCardSuccessFromBot({
            telegramId: BigInt(telegramId),
            invoicePayload: pay.invoice_payload,
            amountMinor: pay.total_amount,
            currency: pay.currency,
            telegramPaymentChargeId: pay.telegram_payment_charge_id,
            providerPaymentChargeId: pay.provider_payment_charge_id,
          });
        }
        const isRu = ctx.from?.language_code?.startsWith('ru');
        await ctx.reply(
          isRu
            ? '🎉 Premium активирован. Открой Mini App — теперь у тебя безлимит целей, AI-планы на 30 дней и расширенная статистика.'
            : '🎉 Premium activated. Open the Mini App — unlimited goals, 30-day AI plans and advanced stats are now yours.',
        );
      } catch (err) {
        this.logger.error(`Failed to apply payment: ${(err as Error).message}`);
        await ctx.reply(
          'Платёж получен, но активация Premium не сработала. Напиши /feedback — разберёмся.',
        );
      }
    });

    this.bot.catch((err) => this.logger.error(`Bot error: ${err}`));

    // -----------------------------------------------------------------------
    // Mode selection: webhook (preferred, used in production via the CF Worker
    // proxy) vs long-polling (fallback for local dev or if the webhook URL is
    // unset). Webhook mode requires the controller to forward updates to
    // `this.handleUpdate()`.
    // -----------------------------------------------------------------------
    const webhookUrl = envString('TELEGRAM_WEBHOOK_URL', '');
    const webhookSecret = envString('TELEGRAM_WEBHOOK_SECRET', '');

    if (webhookUrl) {
      // grammy's `init()` calls getMe() once so middleware that depends on
      // `bot.botInfo` works inside webhook handlers.
      await this.bot.init();
      try {
        await this.bot.api.setWebhook(webhookUrl, {
          secret_token: webhookSecret || undefined,
          drop_pending_updates: false,
          allowed_updates: ['message', 'callback_query', 'pre_checkout_query'],
        });
        this.mode = 'webhook';
        this.logger.log(`Bot in webhook mode → ${webhookUrl} (@${this.bot.botInfo.username})`);
      } catch (err) {
        this.logger.error(`setWebhook failed: ${(err as Error).message}. Falling back to long-polling.`);
        this.startLongPolling();
      }
    } else {
      this.startLongPolling();
    }
  }

  private startLongPolling(): void {
    if (!this.bot) return;
    this.mode = 'long-polling';
    void this.bot.start({
      onStart: (info) => this.logger.log(`Bot started in long-polling mode as @${info.username}`),
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.bot) return;
    if (this.mode === 'long-polling') {
      await this.bot.stop();
    }
    // In webhook mode there is no long-running task to stop. Don't remove the
    // webhook on shutdown — that would deafen the bot until next boot.
  }

  /**
   * Hand a raw Telegram update to grammy. Called by `BotController` when the
   * Worker forwards a webhook payload. No-op if the bot isn't initialised yet.
   */
  async handleUpdate(update: unknown): Promise<void> {
    if (!this.bot) return;
    await this.bot.handleUpdate(update as Parameters<Bot['handleUpdate']>[0]);
  }

  /** True when an incoming webhook secret matches the configured one. */
  verifyWebhookSecret(provided: string | undefined): boolean {
    const expected = envString('TELEGRAM_WEBHOOK_SECRET', '');
    if (!expected) return true; // no secret configured → allow (dev only)
    return !!provided && provided === expected;
  }

  modeForStatus(): 'webhook' | 'long-polling' | 'disabled' {
    return this.mode;
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
