import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksScheduler } from './tasks.scheduler';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [GamificationModule],
  providers: [TasksService, TasksScheduler],
  controllers: [TasksController],
  exports: [TasksService],
})
export class TasksModule {}
