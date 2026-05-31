import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AppAdminController } from './app-admin.controller';
import { AdminBasicAuthGuard } from './admin.guard';
import { AdminUserGuard } from './admin-user.guard';

@Module({
  providers: [AdminBasicAuthGuard, AdminUserGuard],
  controllers: [AdminController, AppAdminController],
})
export class AdminModule {}
