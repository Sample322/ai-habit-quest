import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import { AdminBasicAuthGuard } from './admin.guard';

class GrantPremiumDto {
  @IsBoolean()
  isPremium!: boolean;

  @IsOptional() @IsString()
  until?: string; // ISO date
}

@UseGuards(AdminBasicAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('users')
  async listUsers(@Query('q') q?: string, @Query('premium') premium?: string) {
    const where: Record<string, unknown> = {};
    if (premium === 'true') where['isPremium'] = true;
    if (premium === 'false') where['isPremium'] = false;
    if (q) {
      where['OR'] = [
        { username: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        languageCode: true,
        isPremium: true,
        premiumUntil: true,
        streakCurrent: true,
        xpTotal: true,
        level: true,
        createdAt: true,
      },
    });
    return users.map((u) => ({ ...u, telegramId: u.telegramId.toString() }));
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        goals: { include: { habits: true } },
        subscriptions: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!u) return null;
    return { ...u, telegramId: u.telegramId.toString() };
  }

  @Post('users/:id/premium')
  async grantPremium(@Param('id') id: string, @Body() body: GrantPremiumDto) {
    const until = body.until ? new Date(body.until) : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    const u = await this.prisma.user.update({
      where: { id },
      data: {
        isPremium: body.isPremium,
        premiumUntil: body.isPremium ? until : null,
      },
    });
    return { id: u.id, isPremium: u.isPremium, premiumUntil: u.premiumUntil };
  }

  @Get('payments')
  async listPayments() {
    const rows = await this.prisma.paymentEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { username: true, firstName: true } } },
    });
    return rows;
  }

  @Get('feedback')
  async listFeedback() {
    return this.prisma.feedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { user: { select: { username: true, firstName: true } } },
    });
  }
}
