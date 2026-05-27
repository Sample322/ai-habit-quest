import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { HabitsService } from './habits.service';

class CreateHabitDto {
  @IsString() @MinLength(2) @MaxLength(120)
  title!: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class HabitsController {
  constructor(private readonly habits: HabitsService) {}

  @Get('goals/:goalId/habits')
  list(@CurrentUser() me: AuthenticatedUser, @Param('goalId') goalId: string) {
    return this.habits.listForGoal(me.id, goalId);
  }

  @Post('goals/:goalId/habits')
  create(
    @CurrentUser() me: AuthenticatedUser,
    @Param('goalId') goalId: string,
    @Body() body: CreateHabitDto,
  ) {
    return this.habits.create(me.id, goalId, body.title);
  }

  @Delete('habits/:id')
  remove(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.habits.remove(me.id, id);
  }
}
