import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

// P3.1: авторизация по ролям — дыры здесь уже находили и чинили вручную
// (0.5.0), поэтому guard покрыт тестами явно.

function makeGuard(required: Role[] | undefined) {
  const reflector: any = { getAllAndOverride: jest.fn().mockReturnValue(required) };
  return new RolesGuard(reflector);
}

function makeContext(user: unknown) {
  return {
    getHandler: () => jest.fn(),
    getClass: () => class Mock {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as never;
}

describe('RolesGuard', () => {
  it('эндпоинт без @Roles — доступ разрешён любой авторизованной роли', () => {
    expect(makeGuard(undefined).canActivate(makeContext({ sub: 'u', gymId: 'g', role: Role.CLIENT }))).toBe(true);
  });

  it('роль в списке — доступ разрешён', () => {
    expect(makeGuard([Role.CEO, Role.STAFF]).canActivate(makeContext({ sub: 'u', gymId: 'g', role: Role.STAFF }))).toBe(true);
  });

  it('роль не в списке — Forbidden', () => {
    expect(() => makeGuard([Role.CEO]).canActivate(makeContext({ sub: 'u', gymId: 'g', role: Role.CLIENT }))).toThrow(ForbiddenException);
  });

  it('нет пользователя в запросе (JwtAuthGuard не отработал) — Forbidden', () => {
    expect(() => makeGuard([Role.CEO]).canActivate(makeContext(undefined))).toThrow(ForbiddenException);
  });

  it('пустой список @Roles() — как будто ограничения нет', () => {
    expect(makeGuard([]).canActivate(makeContext({ sub: 'u', gymId: 'g', role: Role.TRAINER }))).toBe(true);
  });
});
