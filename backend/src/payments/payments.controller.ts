import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

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

  @UseGuards(JwtAuthGuard)
  @Post('yookassa/start-trial')
  async startTrial(@CurrentUser() me: AuthenticatedUser) {
    return this.payments.startYooKassaTrial(me.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('stars/invoice')
  async starsInvoice(@CurrentUser() me: AuthenticatedUser) {
    return this.payments.createStarsInvoice(me.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('trial/claim')
  async trialClaim(@CurrentUser() me: AuthenticatedUser) {
    return this.payments.claimFreeTrial(me.id);
  }

  @Post('yookassa/webhook')
  async yooKassaWebhook(@Body() body: Record<string, unknown>) {
    return this.payments.handleYooKassaWebhook(body);
  }
}
