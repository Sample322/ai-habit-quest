import { Module } from '@nestjs/common';
import { NotificationsScheduler } from './notifications.scheduler';
import { BotModule } from '../bot/bot.module';
import { TasksModule } from '../tasks/tasks.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [BotModule, TasksModule, AiModule],
  providers: [NotificationsScheduler],
})
export class NotificationsModule {}
