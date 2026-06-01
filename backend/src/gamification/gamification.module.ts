import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { LeaguesService } from './leagues.service';

@Module({
  providers: [GamificationService, LeaguesService],
  controllers: [GamificationController],
  exports: [GamificationService],
})
export class GamificationModule {}
