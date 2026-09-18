import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@prisma/client';
import { JwtStrategy } from './jwt.strategy';

// P3.8: каждый запрос сверяет версию сессии из токена с актуальной из БД —
// отзыв (увольнение, смена пароля, logout-all) убивает старые токены
// немедленно, а не по истечении 7-дневного TTL.

function makeStrategy(user: { isActive: boolean; sessionVersion: number } | null) {
  const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const config = new ConfigService({ JWT_SECRET: 'test-secret' });
  return { strategy: new JwtStrategy(config, prisma), prisma };
}

function payload(overrides: Record<string, unknown> = {}) {
  return { sub: 'user1', gymId: 'gym1', role: 'CLIENT' as Role, sesVer: 3, ...overrides };
}

describe('JwtStrategy.validate (отзыв сессий P3.8)', () => {
  it('актуальная версия сессии — payload проходит в request.user', async () => {
    const { strategy } = makeStrategy({ isActive: true, sessionVersion: 3 });
    await expect(strategy.validate(payload())).resolves.toEqual(payload());
  });

  it('версия в токене меньше актуальной — Unauthorized (сессия отозвана)', async () => {
    const { strategy } = makeStrategy({ isActive: true, sessionVersion: 4 });
    await expect(strategy.validate(payload())).rejects.toThrow(UnauthorizedException);
  });

  it('токен без версии сессии (старый формат) — Unauthorized', async () => {
    const { strategy } = makeStrategy({ isActive: true, sessionVersion: 0 });
    await expect(strategy.validate(payload({ sesVer: undefined }))).rejects.toThrow(UnauthorizedException);
  });

  it('деактивированный пользователь теряет доступ сразу, даже с верной версией', async () => {
    const { strategy } = makeStrategy({ isActive: false, sessionVersion: 3 });
    await expect(strategy.validate(payload())).rejects.toThrow(/деактивирована/i);
  });

  it('удалённый пользователь — Unauthorized', async () => {
    const { strategy } = makeStrategy(null);
    await expect(strategy.validate(payload())).rejects.toThrow(UnauthorizedException);
  });
});
