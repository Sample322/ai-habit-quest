import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

import { envString } from '../config/env';

@Injectable()
export class AdminBasicAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Basic ')) throw new UnauthorizedException('Basic auth required');

    let decoded: string;
    try {
      decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    } catch {
      throw new UnauthorizedException('Bad credentials');
    }

    const idx = decoded.indexOf(':');
    if (idx < 0) throw new UnauthorizedException('Bad credentials');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);

    const expectedUser = envString('ADMIN_BASIC_USER', 'admin');
    const expectedPass = envString('ADMIN_BASIC_PASSWORD');

    if (!safeEqual(user, expectedUser) || !safeEqual(pass, expectedPass)) {
      throw new UnauthorizedException('Invalid admin credentials');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}
