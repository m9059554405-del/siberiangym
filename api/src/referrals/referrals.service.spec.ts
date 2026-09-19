import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { ReferralsService } from './referrals.service';

// P4.4: реферальная программа — ключевые guard'ы apply и ленивая выдача кода.

const ACTOR = { sub: 'user-new', gymId: 'gym1', role: 'CLIENT' as Role };

function makeService() {
  const prisma: any = {
    client: { findFirst: jest.fn(), update: jest.fn() },
    referralSettings: { findUnique: jest.fn(), create: jest.fn() },
    referral: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    promoCode: { findMany: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const activityLog: any = { log: jest.fn() };
  const service = new ReferralsService(prisma, activityLog);
  return { service, prisma, activityLog };
}

const NEW_CLIENT = { id: 'new1', gymId: 'gym1', userId: 'user-new', name: 'Новичок', referralCode: null };
const FRIEND = { id: 'friend1', gymId: 'gym1', name: 'Друг', referralCode: 'FRND2026' };

function enableProgram(prisma: any) {
  prisma.referralSettings.findUnique.mockResolvedValue({ gymId: 'gym1', enabled: true, referrerPercent: 10, referredPercent: 15 });
}

describe('ReferralsService (P4.4)', () => {
  it('me лениво выдаёт реферальный код клиенту без кода', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue(NEW_CLIENT);
    prisma.client.update.mockResolvedValue({ ...NEW_CLIENT, referralCode: 'ABCD2345' });
    prisma.promoCode.findMany.mockResolvedValue([]);
    prisma.referral.findMany.mockResolvedValue([]);

    const result = await service.me(ACTOR);

    expect(prisma.client.update).toHaveBeenCalled();
    expect(result.referralCode).toBe('ABCD2345');
  });

  it('apply: свой код активировать нельзя', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue({ ...NEW_CLIENT, referralCode: 'MINE1234' });
    enableProgram(prisma);

    await expect(service.apply(ACTOR, { code: 'MINE1234' })).rejects.toThrow(BadRequestException);
  });

  it('apply: код другой точки не находится', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue(NEW_CLIENT);
    enableProgram(prisma);
    prisma.client.findFirst.mockResolvedValueOnce(NEW_CLIENT).mockResolvedValueOnce(null);

    await expect(service.apply(ACTOR, { code: 'FRND2026' })).rejects.toThrow(NotFoundException);
  });

  it('apply: повторная активация — Conflict', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValueOnce(NEW_CLIENT).mockResolvedValueOnce(FRIEND);
    enableProgram(prisma);
    prisma.referral.findUnique.mockResolvedValue({ id: 'ref1' });

    await expect(service.apply(ACTOR, { code: 'FRND2026' })).rejects.toThrow(ConflictException);
  });

  it('apply: выключенная программа — BadRequest', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue(NEW_CLIENT);
    prisma.referralSettings.findUnique.mockResolvedValue({ gymId: 'gym1', enabled: false, referrerPercent: 10, referredPercent: 10 });

    await expect(service.apply(ACTOR, { code: 'FRND2026' })).rejects.toThrow(/отключена/);
  });

  it('apply: успех — связка и два персональных одноразовых промокода', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValueOnce(NEW_CLIENT).mockResolvedValueOnce(FRIEND);
    enableProgram(prisma);
    prisma.referral.findUnique.mockResolvedValue(null);
    prisma.referral.create.mockResolvedValue({ id: 'ref1' });
    prisma.promoCode.create.mockResolvedValue({ id: 'promo-x', code: 'REF-XXXXXX' });

    const result = await service.apply(ACTOR, { code: ' frnd2026 ' });

    expect(prisma.referral.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { gymId: 'gym1', referrerId: 'friend1', referredId: 'new1' } }),
    );
    const promoCalls = prisma.promoCode.create.mock.calls.map((c: any[]) => c[0].data);
    expect(promoCalls.map((d: any) => d.clientId)).toEqual(['friend1', 'new1']);
    expect(promoCalls.map((d: any) => d.percentOff)).toEqual([10, 15]);
    expect(promoCalls.every((d: any) => d.maxUses === 1)).toBe(true);
    expect(result.rewards).toHaveLength(2);
  });

  it('updateSettings обновляет только переданные поля', async () => {
    const { service, prisma } = makeService();
    prisma.referralSettings.findUnique.mockResolvedValue({ gymId: 'gym1', enabled: true, referrerPercent: 10, referredPercent: 10 });
    prisma.referralSettings.create.mockResolvedValue(null);
    prisma.referralSettings.update = jest.fn().mockResolvedValue({ enabled: false, referrerPercent: 10, referredPercent: 25 });

    await service.updateSettings({ sub: 'ceo1', gymId: 'gym1', role: 'CEO' as Role }, { enabled: false, referredPercent: 25 });

    expect(prisma.referralSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enabled: false, referrerPercent: 10, referredPercent: 25 } }),
    );
  });
});
