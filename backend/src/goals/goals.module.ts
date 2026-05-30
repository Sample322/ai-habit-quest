import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';
import { TasksModule } from '../tasks/tasks.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [PlansModule, UsersModule, TasksModule, GamificationModule],
  providers: [GoalsService],
  controllers: [GoalsController],
  exports: [GoalsService],
})
export class GoalsModule {}
