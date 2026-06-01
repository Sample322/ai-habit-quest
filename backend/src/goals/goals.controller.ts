import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { GoalCategory } from '@prisma/client';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { DeletionPreview, DeletionResult, GoalInsights, GoalsService, GoalView } from './goals.service';

class CreateGoalDto {
  @IsString() @MinLength(2) @MaxLength(120)
  title!: string;

  @IsEnum(GoalCategory)
  category!: GoalCategory;
}

@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@CurrentUser() me: AuthenticatedUser): Promise<GoalView[]> {
    return this.goals.listForUser(me.id);
  }

  // Each creation triggers an LLM plan generation — cap it tightly per client.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post()
  create(
    @CurrentUser() me: AuthenticatedUser,
    @Body() body: CreateGoalDto,
  ): Promise<GoalView> {
    return this.goals.createForUser(me.id, body);
  }

  @Get(':id')
  one(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.goals.findById(id, me.id);
  }

  // Also an LLM call — same tight cap as creation. Premium-only feature.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/regenerate-plan')
  regeneratePlan(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    if (!me.isPremium) {
      throw new ForbiddenException({ code: 'premium_required', message: 'Regenerating the plan is a Premium feature.' });
    }
    return this.goals.regeneratePlan(id, me.id);
  }

  @Get(':id/insights')
  insights(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<GoalInsights> {
    return this.goals.insights(id, me.id);
  }

  @Get(':id/delete-preview')
  previewDeletion(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DeletionPreview> {
    return this.goals.previewDeletion(id, me.id);
  }

  @Delete(':id')
  remove(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<DeletionResult> {
    return this.goals.deleteGoal(id, me.id);
  }
}
