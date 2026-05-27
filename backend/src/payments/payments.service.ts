import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { SubscriptionProvider, SubscriptionStatus, PaymentEventStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { envString } from '../config/env';
import { YooKassaProvider } from './yookassa.provider';
import { TelegramStarsProvider } from './stars.provider';

const TRIAL_PRICE_RUB = 1;
const MONTH_PRICE_RUB = 299;
const PREMIUM_STARS = 250; // tune in Phase 3

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
   * Webhook entry for Telegram Stars `successful_payment` callbacks (Bot API).
   * Real wiring will live next to the bot webhook in Phase 3.
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

  prices() {
    return {
      trialPriceRub: TRIAL_PRICE_RUB,
      monthlyPriceRub: MONTH_PRICE_RUB,
      premiumStars: PREMIUM_STARS,
    };
  }
}
