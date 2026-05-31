import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Request } from 'express';

import { AuthenticatedUser } from '../auth/jwt.strategy';
import { isAdminTelegramId } from './is-admin';

/**
 * Authorises in-app admin endpoints. Must run AFTER JwtAuthGuard (which sets
 * req.user); allows only Telegram IDs in ADMIN_TELEGRAM_IDS.
 */
@Injectable()
export class AdminUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = req.user;
    if (!user || !isAdminTelegramId(user.telegramId)) {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
