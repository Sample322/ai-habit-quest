import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { HabitsService } from './habits.service';

class CreateHabitDto {
  @IsString() @MinLength(2) @MaxLength(120)
  title!: string;
}

class UpdateHabitDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120)
  title?: string;

  @IsOptional() @IsInt() @Min(0) @Max(127)
  scheduleMask?: number;

  @IsOptional() @IsBoolean()
  reminderEnabled?: boolean;

  @IsOptional() @IsInt() @Min(0) @Max(23)
  reminderHour?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(59)
  reminderMinute?: number | null;
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

  @Patch('habits/:id')
  update(
    @CurrentUser() me: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdateHabitDto,
  ) {
    return this.habits.update(me.id, id, body);
  }

  @Delete('habits/:id')
  remove(@CurrentUser() me: AuthenticatedUser, @Param('id') id: string) {
    return this.habits.remove(me.id, id);
  }
}
