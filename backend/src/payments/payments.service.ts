import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SubscriptionProvider, SubscriptionStatus, PaymentEventStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';
import { YooKassaProvider } from './yookassa.provider';
import { TelegramStarsProvider } from './stars.provider';

const TRIAL_PRICE_RUB = 1;
const MONTH_PRICE_RUB = 299;
const PREMIUM_STARS = 1; // smoke-test price; raise before public launch

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly yookassa: YooKassaProvider,
    private readonly stars: TelegramStarsProvider,
  ) {}

  async startYooKassaTrial(userId: string) {
    const returnUrl = envString('YOOKASSA_RETURN_URL', 'https://t.me');
    const payment = await this.yookassa.createPayment({
      amountRub: TRIAL_PRICE_RUB,
      description: 'AI Habit Quest — 3-day trial',
      userId,
      savePaymentMethod: true,
      returnUrl,
    });

    const subscription = await this.prisma.subscription.create({
      data: {
        userId,
        provider: SubscriptionProvider.yookassa,
        status: SubscriptionStatus.trial,
        externalId: payment.externalId,
      },
    });

    await this.prisma.paymentEvent.create({
      data: {
        userId,
        subscriptionId: subscription.id,
        provider: SubscriptionProvider.yookassa,
        externalId: payment.externalId,
        amountMinor: TRIAL_PRICE_RUB * 100,
        currency: 'RUB',
        status: PaymentEventStatus.pending,
      },
    });

    return { confirmationUrl: payment.confirmationUrl, subscriptionId: subscription.id };
  }

  async createStarsInvoice(userId: string) {
    const result = await this.stars.createInvoiceLink({
      title: 'AI Habit Quest Premium',
      description: '1 month of Premium: unlimited goals, 30-day AI plan, AI coaching, streak recovery.',
      payload: `premium:${userId}:${Date.now()}`,
      stars: PREMIUM_STARS,
    });
    return result;
  }

  /**
   * Create a card-payment invoice link via Telegram Bot Payments. Uses a
   * BotFather-issued provider token (ЮKassa/etc.) — payment happens inside
   * Telegram's UI without a browser redirect. Client receives a t.me/$...
   * link and opens it through Telegram.WebApp.openInvoice.
   */
  async createCardInvoice(userId: string) {
    const result = await this.stars.createCardInvoiceLink({
      title: 'AI Habit Quest Premium',
      description: '1 месяц Premium: безлимит целей, 30-дневный AI-план, восстановление серии, ежедневный AI-бонус.',
      payload: `premium-card:${userId}:${Date.now()}`,
      amountRub: MONTH_PRICE_RUB,
    });
    return result;
  }

  /**
   * Free 3-day trial — claimable exactly once per account, no payment needed.
   * Grants Premium immediately and timestamps the claim so the user can never
   * use it again. The notifications scheduler picks up the expiry to send a
   * one-off "subscribe now" DM.
   */
  async claimFreeTrial(userId: string): Promise<{
    isPremium: boolean;
    premiumUntil: string;
    trialClaimedAt: string;
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.trialClaimedAt) {
      throw new BadRequestException({
        code: 'trial_already_used',
        message: 'Free trial already used on this account.',
      });
    }
    const ADMIN_SENTINEL = new Date('2099-12-31T23:59:59Z').getTime();
    if (user.premiumUntil && user.premiumUntil.getTime() === ADMIN_SENTINEL) {
      throw new BadRequestException({
        code: 'already_premium',
        message: 'You already have Premium.',
      });
    }
    const now = new Date();
    const TRIAL_MS = 3 * 24 * 60 * 60 * 1000;
    const base = user.premiumUntil && user.premiumUntil > now ? user.premiumUntil : now;
    const newUntil = new Date(base.getTime() + TRIAL_MS);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: true,
        premiumUntil: newUntil,
        trialClaimedAt: now,
        trialReminderSent: false,
      },
    });

    this.logger.log(`Free trial claimed user=${userId} until=${newUntil.toISOString()}`);
    return {
      isPremium: updated.isPremium,
      premiumUntil: updated.premiumUntil!.toISOString(),
      trialClaimedAt: now.toISOString(),
    };
  }

  /**
   * Webhook entry for YooKassa "payment.succeeded" notifications.
   * Skeleton — real signature verification belongs to Phase 3 with test credentials.
   */
  async handleYooKassaWebhook(payload: Record<string, unknown>): Promise<{ ok: true }> {
    this.logger.log(`YooKassa webhook received: ${JSON.stringify(payload).slice(0, 200)}`);
    const event = (payload as { event?: string }).event;
    const object = (payload as { object?: Record<string, unknown> }).object;
    if (!event || !object) throw new BadRequestException('Malformed webhook');

    if (event === 'payment.succeeded') {
      const externalId = String(object['id']);
      const paymentMethod = object['payment_method'] as { id?: string } | undefined;
      const paymentEvent = await this.prisma.paymentEvent.findFirst({ where: { externalId } });
      if (!paymentEvent) {
        this.logger.warn(`Unknown YooKassa externalId ${externalId}`);
        return { ok: true };
      }
      await this.prisma.paymentEvent.update({
        where: { id: paymentEvent.id },
        data: { status: PaymentEventStatus.succeeded, rawPayload: payload as unknown as object },
      });
      if (paymentEvent.subscriptionId) {
        await this.prisma.subscription.update({
          where: { id: paymentEvent.subscriptionId },
          data: {
            status: SubscriptionStatus.active,
            paymentMethodId: paymentMethod?.id ?? null,
            currentPeriodEnd: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
          },
        });
      }
      await this.prisma.user.update({
        where: { id: paymentEvent.userId },
        data: {
          isPremium: true,
          premiumUntil: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
        },
      });
    }
    return { ok: true };
  }

  /**
   * Apply a successful Telegram Stars payment by internal userId.
   * Used by webhook variants where we already resolved the user.
   */
  async handleStarsSuccess(userId: string, invoicePayload: string, stars: number) {
    await this.prisma.paymentEvent.create({
      data: {
        userId,
        provider: SubscriptionProvider.telegram_stars,
        externalId: invoicePayload,
        amountMinor: stars,
        currency: 'XTR',
        status: PaymentEventStatus.succeeded,
      },
    });
    await this.prisma.subscription.create({
      data: {
        userId,
        provider: SubscriptionProvider.telegram_stars,
        status: SubscriptionStatus.active,
        externalId: invoicePayload,
        currentPeriodEnd: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
      },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isPremium: true,
        premiumUntil: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
      },
    });
  }

  /**
   * Called by the grammy bot when Telegram emits `successful_payment`.
   * Resolves the internal user by telegramId, makes the upgrade idempotent
   * via the (provider, externalId) uniqueness on the payload.
   */
  async handleStarsSuccessFromBot(input: {
    telegramId: bigint;
    invoicePayload: string;
    stars: number;
    currency: string;
    telegramPaymentChargeId: string;
  }): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { telegramId: input.telegramId } });
    if (!user) {
      this.logger.warn(`Stars payment for unknown telegramId=${input.telegramId}`);
      return;
    }
    // Idempotency: if we already processed this charge, skip.
    const existing = await this.prisma.paymentEvent.findFirst({
      where: { externalId: input.telegramPaymentChargeId, provider: SubscriptionProvider.telegram_stars },
    });
    if (existing) {
      this.logger.log(`Stars payment ${input.telegramPaymentChargeId} already processed`);
      return;
    }
    await this.handleStarsSuccess(user.id, input.invoicePayload, input.stars);
    // Also persist the Telegram charge id separately so repeated webhooks are deduped.
    await this.prisma.paymentEvent.create({
      data: {
        userId: user.id,
        provider: SubscriptionProvider.telegram_stars,
        externalId: input.telegramPaymentChargeId,
        amountMinor: input.stars,
        currency: input.currency,
        status: PaymentEventStatus.succeeded,
        rawPayload: input as unknown as object,
      },
    });
  }

  prices() {
    return {
      trialPriceRub: TRIAL_PRICE_RUB,
      monthlyPriceRub: MONTH_PRICE_RUB,
      premiumStars: PREMIUM_STARS,
    };
  }

  /**
   * Apply a successful Telegram Bot Payments (card / RUB) charge. Idempotent
   * via the provider_payment_charge_id from Telegram.
   */
  async handleCardSuccessFromBot(input: {
    telegramId: bigint;
    invoicePayload: string;
    amountMinor: number; // kopecks
    currency: string;
    telegramPaymentChargeId: string;
    providerPaymentChargeId: string;
  }): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { telegramId: input.telegramId } });
    if (!user) {
      this.logger.warn(`Card payment for unknown telegramId=${input.telegramId}`);
      return;
    }
    const existing = await this.prisma.paymentEvent.findFirst({
      where: { externalId: input.providerPaymentChargeId, provider: SubscriptionProvider.yookassa },
    });
    if (existing) {
      this.logger.log(`Card payment ${input.providerPaymentChargeId} already processed`);
      return;
    }

    const periodEnd = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.paymentEvent.create({
        data: {
          userId: user.id,
          provider: SubscriptionProvider.yookassa,
          externalId: input.providerPaymentChargeId,
          amountMinor: input.amountMinor,
          currency: input.currency,
          status: PaymentEventStatus.succeeded,
          rawPayload: input as unknown as object,
        },
      }),
      this.prisma.subscription.create({
        data: {
          userId: user.id,
          provider: SubscriptionProvider.yookassa,
          status: SubscriptionStatus.active,
          externalId: input.providerPaymentChargeId,
          currentPeriodEnd: periodEnd,
        },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isPremium: true, premiumUntil: periodEnd },
      }),
    ]);
    this.logger.log(
      `Card payment applied user=${user.id} amount=${input.amountMinor / 100} ${input.currency}`,
    );
  }
}
