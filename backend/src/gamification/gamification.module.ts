import { Module } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { GamificationController } from './gamification.controller';
import { LeaguesService } from './leagues.service';
import { SeasonsService } from './seasons.service';

@Module({
  providers: [GamificationService, LeaguesService, SeasonsService],
  controllers: [GamificationController],
  exports: [GamificationService],
})
export class GamificationModule {}
