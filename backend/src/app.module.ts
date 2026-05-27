import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GoalsModule } from './goals/goals.module';
import { HabitsModule } from './habits/habits.module';
import { PlansModule } from './plans/plans.module';
import { TasksModule } from './tasks/tasks.module';
import { GamificationModule } from './gamification/gamification.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BotModule } from './bot/bot.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    GoalsModule,
    HabitsModule,
    PlansModule,
    TasksModule,
    GamificationModule,
    AiModule,
    NotificationsModule,
    BotModule,
    PaymentsModule,
    AdminModule,
  ],
})
export class AppModule {}
