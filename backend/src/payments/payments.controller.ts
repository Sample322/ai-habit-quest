import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('prices')
  prices() {
    return this.payments.prices();
  }

  // Each of the *invoice* endpoints calls Telegram createInvoiceLink — keep
  // tight per-IP so a malicious client can't burn the bot's API quota.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('yookassa/start-trial')
  async startTrial(@CurrentUser() me: AuthenticatedUser) {
    return this.payments.startYooKassaTrial(me.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('stars/invoice')
  async starsInvoice(@CurrentUser() me: AuthenticatedUser) {
    return this.payments.createStarsInvoice(me.id);
  }

  // One-time-per-account trial — clients only need to call once successfully,
  // so 5/min is plenty even with retries.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('trial/claim')
  async trialClaim(@CurrentUser() me: AuthenticatedUser) {
    return this.payments.claimFreeTrial(me.id);
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('card/invoice')
  async cardInvoice(@CurrentUser() me: AuthenticatedUser) {
    return this.payments.createCardInvoice(me.id);
  }

  @Post('yookassa/webhook')
  async yooKassaWebhook(@Body() body: Record<string, unknown>) {
    return this.payments.handleYooKassaWebhook(body);
  }
}
