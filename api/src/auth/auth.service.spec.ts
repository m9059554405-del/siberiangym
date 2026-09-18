import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';

// P3.1: сценарий входа (критичный из бэклога) — реальный bcrypt и реальный
// подпись JWT, мок только на чтение пользователя из БД.

const PASSWORD_HASH = bcrypt.hashSync('correct-horse', 4); // раунды ниже — тест не про скорость хэша

function makeService(user: unknown) {
  const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
  const jwt = new JwtService({ secret: 'test-secret' });
  return { service: new AuthService(prisma, jwt), prisma };
}

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user1',
    gymId: 'gym1',
    email: 'client@siberiangym.ru',
    passwordHash: PASSWORD_HASH,
    role: Role.CLIENT,
    isActive: true,
    ...overrides,
  };
}

describe('AuthService.login', () => {
  it('успешный вход возвращает токен с payload (sub/gymId/role)', async () => {
    const { service } = makeService(userFixture());
    const res = await service.login('client@siberiangym.ru', 'correct-horse');

    expect(res.user).toEqual({ id: 'user1', email: 'client@siberiangym.ru', role: 'CLIENT', gymId: 'gym1' });
    const decoded = new JwtService({ secret: 'test-secret' }).decode(res.accessToken) as Record<string, unknown>;
    expect(decoded.sub).toBe('user1');
    expect(decoded.gymId).toBe('gym1');
    expect(decoded.role).toBe('CLIENT');
  });

  it('несуществующий email — единая ошибка «Неверный email или пароль» (не раскрывает существование)', async () => {
    const { service } = makeService(null);
    await expect(service.login('nobody@siberiangym.ru', 'x')).rejects.toThrow(UnauthorizedException);
  });

  it('неверный пароль — Unauthorized', async () => {
    const { service } = makeService(userFixture());
    await expect(service.login('client@siberiangym.ru', 'wrong')).rejects.toThrow(UnauthorizedException);
  });

  it('деактивированный пользователь (P2.10/P3.9) не входит даже с верным паролем', async () => {
    const { service } = makeService(userFixture({ isActive: false }));
    await expect(service.login('client@siberiangym.ru', 'correct-horse')).rejects.toThrow(UnauthorizedException);
  });
});

describe('AuthService.switchGym (P1.1)', () => {
  const ceo = { sub: 'owner1', gymId: 'gym1', role: Role.CEO };

  it('не-CEO не может переключать точки', async () => {
    const { service } = makeService(null);
    const staff = { sub: 'staff1', gymId: 'gym1', role: Role.STAFF };
    await expect(service.switchGym(staff, 'gym2')).rejects.toThrow(ForbiddenException);
  });
});
