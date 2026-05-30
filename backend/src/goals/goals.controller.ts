import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { GoalCategory } from '@prisma/client';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { DeletionPreview, DeletionResult, GoalsService, GoalView } from './goals.service';

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
