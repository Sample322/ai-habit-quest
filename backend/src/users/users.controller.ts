import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { JwtAuthGuard, CurrentUser } from '../auth/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

class UpdatePreferencesDto {
  @IsOptional() @IsString() languageCode?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsInt() @Min(0) @Max(23) reminderHour?: number;
  @IsOptional() @IsInt() @Min(0) @Max(59) reminderMinute?: number;
  @IsOptional() @IsBoolean() notifReminders?: boolean;
  @IsOptional() @IsBoolean() notifAchievements?: boolean;
  @IsOptional() @IsBoolean() notifSeasons?: boolean;
  @IsOptional() @IsBoolean() notifStreakBreak?: boolean;
  @IsOptional() @IsBoolean() notifWeeklyRecap?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(3) @IsString({ each: true })
  showcaseAchievements?: string[];

  @IsOptional() @IsString() @IsIn(['gentle', 'strict', 'humor'])
  aiCoachingStyle?: string | null;
}

@UseGuards(JwtAuthGuard)
@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async getMe(@CurrentUser() me: AuthenticatedUser) {
    return this.users.getProfile(me.id);
  }

  @Patch('preferences')
  async updatePrefs(@CurrentUser() me: AuthenticatedUser, @Body() body: UpdatePreferencesDto) {
    return this.users.updatePreferences(me.id, body);
  }
}
