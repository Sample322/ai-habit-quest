import { Module } from '@nestjs/common';

import { BonusService } from './bonus.service';
import { BonusController } from './bonus.controller';
import { UsersModule } from '../users/users.module';
import { AiModule } from '../ai/ai.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [UsersModule, AiModule, GamificationModule],
  providers: [BonusService],
  controllers: [BonusController],
})
export class BonusModule {}
