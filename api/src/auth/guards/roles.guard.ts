import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { JwtPayload } from '../auth.service';

// Применяется ПОСЛЕ JwtAuthGuard — читает роль из уже провалидированного
// токена (request.user) и сверяет со списком в @Roles(...).
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!required || required.length === 0) {
      if (user?.role === Role.SYSADMIN) {
        throw new ForbiddenException('Недостаточно прав для этого действия');
      }
      return true;
    }

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Недостаточно прав для этого действия');
    }
    return true;
  }
}
