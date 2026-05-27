import { Controller, Get, Param, UseGuards } from '@nestjs/common';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { PlansService } from './plans.service';

@UseGuards(JwtAuthGuard)
@Controller('goals/:goalId/plan')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  get(@CurrentUser() me: AuthenticatedUser, @Param('goalId') goalId: string) {
    return this.plans.getForGoal(goalId, me.id);
  }
}
