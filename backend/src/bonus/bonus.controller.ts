import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { BonusService } from './bonus.service';

@UseGuards(JwtAuthGuard)
@Controller('bonus')
export class BonusController {
  constructor(private readonly bonus: BonusService) {}

  /** Today's AI bonus task (premium only; null otherwise). */
  @Get('today')
  today(@CurrentUser() me: AuthenticatedUser) {
    return this.bonus.getToday(me.id);
  }

  @Post(':id/complete')
  complete(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.bonus.complete(me.id, id);
  }
}
