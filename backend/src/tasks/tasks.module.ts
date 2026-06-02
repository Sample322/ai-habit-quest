import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksScheduler } from './tasks.scheduler';
import { GamificationModule } from '../gamification/gamification.module';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [GamificationModule, forwardRef(() => BotModule)],
  providers: [TasksService, TasksScheduler],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
