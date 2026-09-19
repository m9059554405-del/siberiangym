import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { PromoService } from './promo.service';

// P4.4: правила справочника промокодов.

const ACTOR = { sub: 'ceo1', gymId: 'gym1', role: 'CEO' as Role };

function makeService() {
  const prisma: any = {
    promoCode: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  };
  const activityLog: any = { log: jest.fn() };
  const service = new PromoService(prisma, activityLog);
  return { service, prisma, activityLog };
}

describe('PromoService (P4.4)', () => {
  it('код нормализуется в верхний регистр, дефолты применяются', async () => {
    const { service, prisma } = makeService();
    prisma.promoCode.findUnique.mockResolvedValue(null);
    prisma.promoCode.create.mockResolvedValue({ id: 'p1' });

    await service.create(ACTOR, { code: '  newyear2026  ', percentOff: 20 } as never);

    expect(prisma.promoCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gymId: 'gym1', code: 'NEWYEAR2026', percentOff: 20, amountOff: null, maxUses: 1 }),
      }),
    );
  });

  it('нельзя указать и процент, и фиксированную сумму одновременно', async () => {
    const { service } = makeService();
    await expect(service.create(ACTOR, { code: 'X', percentOff: 10, amountOff: 500 } as never)).rejects.toThrow(BadRequestException);
  });

  it('нужно указать хотя бы что-то одно', async () => {
    const { service } = makeService();
    await expect(service.create(ACTOR, { code: 'X' } as never)).rejects.toThrow(/ровно одно/);
  });

  it('дубликат кода на точке — Conflict', async () => {
    const { service, prisma } = makeService();
    prisma.promoCode.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.create(ACTOR, { code: 'X', percentOff: 10 } as never)).rejects.toThrow(ConflictException);
    expect(prisma.promoCode.create).not.toHaveBeenCalled();
  });

  it('дата окончания раньше начала — BadRequest', async () => {
    const { service } = makeService();
    await expect(
      service.create(ACTOR, { code: 'X', percentOff: 10, validFrom: '2026-10-01', validUntil: '2026-09-01' } as never),
    ).rejects.toThrow(/позже/);
  });

  it('использованный промокод не удаляется', async () => {
    const { service, prisma } = makeService();
    prisma.promoCode.findFirst.mockResolvedValue({ id: 'p1', code: 'X', _count: { orders: 3 } });

    await expect(service.remove(ACTOR, 'p1')).rejects.toThrow(ConflictException);
    expect(prisma.promoCode.delete).not.toHaveBeenCalled();
  });

  it('неиспользованный промокод удаляется', async () => {
    const { service, prisma } = makeService();
    prisma.promoCode.findFirst.mockResolvedValue({ id: 'p1', code: 'X', _count: { orders: 0 } });
    prisma.promoCode.delete.mockResolvedValue({ id: 'p1' });

    await expect(service.remove(ACTOR, 'p1')).resolves.toEqual({ deleted: true });
  });

  it('чужой (другой точки) промокод — не найден', async () => {
    const { service, prisma } = makeService();
    prisma.promoCode.findFirst.mockResolvedValue(null);
    await expect(service.setActive(ACTOR, 'p1', false)).rejects.toThrow(NotFoundException);
  });
});
