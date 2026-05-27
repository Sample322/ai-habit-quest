import { Module } from '@nestjs/common';
import { NotificationsScheduler } from './notifications.scheduler';
import { BotModule } from '../bot/bot.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [BotModule, TasksModule],
  providers: [NotificationsScheduler],
})
export class NotificationsModule {}
