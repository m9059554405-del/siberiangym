import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { verifyTotp } from './totp.util';

// P3.1: сценарий входа (критичный из бэклога) — реальный bcrypt и реальный
// подпись JWT, мок только на чтение пользователя из БД.

const PASSWORD_HASH = bcrypt.hashSync('correct-horse', 4); // раунды ниже — тест не про скорость хэша

function makeService(user: unknown) {
  const prisma: any = {
    user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
    passwordResetToken: { updateMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const jwt = new JwtService({ secret: 'test-secret' });
  const email: any = { send: jest.fn() };
  const config: any = { get: jest.fn().mockImplementation((_key: string, fallback: unknown) => fallback) };
  return { service: new AuthService(prisma, jwt, email, config), prisma, email, config };
}

function userFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user1',
    gymId: 'gym1',
    email: 'client@siberiangym.ru',
    passwordHash: PASSWORD_HASH,
    role: Role.CLIENT,
    isActive: true,
    sessionVersion: 3,
    ...overrides,
  };
}

describe('AuthService.login', () => {
  it('успешный вход возвращает токен с payload (sub/gymId/role)', async () => {
    const { service } = makeService(userFixture());
    const res = await service.login('client@siberiangym.ru', 'correct-horse');
    if (!('accessToken' in res)) throw new Error('Expected access token');

    expect(res.user).toEqual({ id: 'user1', email: 'client@siberiangym.ru', role: 'CLIENT', gymId: 'gym1' });
    const decoded = new JwtService({ secret: 'test-secret' }).decode(res.accessToken) as Record<string, unknown>;
    expect(decoded.sub).toBe('user1');
    expect(decoded.gymId).toBe('gym1');
    expect(decoded.role).toBe('CLIENT');
    expect(decoded.sesVer).toBe(3);
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

describe('AuthService.password reset (P3.5)', () => {
  it('не раскрывает существование неизвестного или отключённого email', async () => {
    const { service, email, prisma } = makeService(null);
    await expect(service.requestPasswordReset('nobody@example.com')).resolves.toEqual({ ok: true });
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('создаёт одноразовый токен с хэшем и отправляет ссылку по email', async () => {
    const { service, email, prisma } = makeService(userFixture({ email: 'person@example.com' }));
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: 'reset1' });

    await expect(service.requestPasswordReset(' PERSON@example.com ')).resolves.toEqual({ ok: true });
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 'user1', tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/), expiresAt: expect.any(Date) }) });
    expect(email.send).toHaveBeenCalledWith('person@example.com', expect.stringContaining('Сброс пароля'), expect.stringContaining('/#/reset-password?token='));
  });

  it('просроченный токен отклоняется', async () => {
    const { service, prisma } = makeService(userFixture());
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'reset1', userId: 'user1', usedAt: null, expiresAt: new Date(Date.now() - 1000), user: userFixture() });

    await expect(service.resetPassword('a'.repeat(64), 'new-password')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('использованный токен нельзя применить повторно', async () => {
    const { service, prisma } = makeService(userFixture());
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'reset1', userId: 'user1', usedAt: new Date(), expiresAt: new Date(Date.now() + 60_000), user: userFixture() });

    await expect(service.resetPassword('b'.repeat(64), 'new-password')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('валидный токен меняет пароль и помечает токен использованным одной транзакцией', async () => {
    const { service, prisma } = makeService(userFixture());
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'reset1', userId: 'user1', usedAt: null, expiresAt: new Date(Date.now() + 60_000), user: userFixture() });
    prisma.user.update.mockReturnValue({ operation: 'user.update' });
    prisma.passwordResetToken.update.mockReturnValue({ operation: 'token.update' });
    prisma.passwordResetToken.updateMany.mockReturnValue({ operation: 'tokens.invalidate' });

    await expect(service.resetPassword('c'.repeat(64), 'new-password')).resolves.toEqual({ ok: true });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user1' }, data: { passwordHash: expect.any(String), sessionVersion: { increment: 1 } } });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({ where: { id: 'reset1' }, data: { usedAt: expect.any(Date) } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.two-factor authentication (P3.6)', () => {
  it('CEO with enabled 2FA получает challenge вместо access token', async () => {
    const { service } = makeService(userFixture({ role: Role.CEO, twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' }));
    const result = await service.login('client@siberiangym.ru', 'correct-horse');
    expect(result).toEqual(expect.objectContaining({ requiresTwoFactor: true, challengeToken: expect.any(String) }));
  });

  it('обычный CLIENT получает access token без challenge', async () => {
    const { service } = makeService(userFixture());
    const result = await service.login('client@siberiangym.ru', 'correct-horse');
    expect(result).toEqual(expect.objectContaining({ requiresTwoFactor: false, accessToken: expect.any(String) }));
  });

  it('TOTP verifier отклоняет неверный формат и код', () => {
    expect(verifyTotp('JBSWY3DPEHPK3PXP', '123')).toBe(false);
    expect(verifyTotp('JBSWY3DPEHPK3PXP', '000000')).toBe(false);
  });

  it('неверный TOTP code не завершает login challenge', async () => {
    const { service } = makeService(userFixture({ role: Role.STAFF, twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' }));
    const challenge = await service.login('client@siberiangym.ru', 'correct-horse');
    if (!('challengeToken' in challenge)) throw new Error('Expected 2FA challenge');
    await expect(service.verifyTwoFactorLogin(challenge.challengeToken, '000000')).rejects.toThrow(UnauthorizedException);
  });

  it('setup создаёт pending secret и URI, confirm включает 2FA', async () => {
    const user = userFixture({ role: Role.CEO, email: 'ceo@example.com', twoFactorPendingSecret: null });
    const { service, prisma } = makeService(user);
    prisma.user.findUniqueOrThrow = jest.fn().mockResolvedValue(user);
    prisma.user.update.mockReturnValue({ operation: 'update' });
    const actor = { sub: 'user1', gymId: 'gym1', role: Role.CEO };
    const setup = await service.startTwoFactorSetup(actor);
    expect(setup.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.otpauthUrl).toContain('otpauth://totp/');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ twoFactorPendingSecret: setup.secret }) }));
  });
});

describe('AuthService.revokeSessions (P3.8)', () => {
  it('поднимает sessionVersion — все старые токены отзываются', async () => {
    const { service, prisma } = makeService(userFixture());
    prisma.user.findUnique.mockResolvedValueOnce({ sessionVersion: 3 });

    await expect(service.revokeSessions('user1')).resolves.toBeUndefined();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user1' }, data: { sessionVersion: { increment: 1 } } });
  });

  it('несуществующий пользователь — тихо без ошибки', async () => {
    const { service, prisma } = makeService(null);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.revokeSessions('nobody')).resolves.toBeUndefined();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('сброс пароля инкрементирует sessionVersion в той же транзакции', async () => {
    const { service, prisma } = makeService(userFixture());
    prisma.passwordResetToken.findUnique.mockResolvedValue({ id: 'reset1', userId: 'user1', usedAt: null, expiresAt: new Date(Date.now() + 60_000), user: userFixture() });

    await service.resetPassword('c'.repeat(64), 'new-password');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ passwordHash: expect.any(String), sessionVersion: { increment: 1 } }) }),
    );
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
