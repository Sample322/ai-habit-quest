import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';
import { ShareCleanupService } from './share.cleanup';

@Module({
  controllers: [ShareController],
  providers: [ShareCleanupService],
})
export class ShareModule {}
