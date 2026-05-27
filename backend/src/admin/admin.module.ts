import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminBasicAuthGuard } from './admin.guard';

@Module({
  providers: [AdminBasicAuthGuard],
  controllers: [AdminController],
})
export class AdminModule {}
