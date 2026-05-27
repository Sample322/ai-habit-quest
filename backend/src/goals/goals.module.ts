import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { PlansModule } from '../plans/plans.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PlansModule, UsersModule],
  providers: [GoalsService],
  controllers: [GoalsController],
  exports: [GoalsService],
})
export class GoalsModule {}
