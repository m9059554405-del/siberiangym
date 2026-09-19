import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Role } from '@prisma/client';
import { CorporateService } from './corporate.service';

// P4.4: корпоративные договоры — участники, защита истории, ведомость.

const ACTOR = { sub: 'staff1', gymId: 'gym1', role: 'STAFF' as Role };

function makeService() {
  const prisma: any = {
    corporateAccount: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    corporateMember: { findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
    client: { findFirst: jest.fn() },
    order: { findMany: jest.fn() },
  };
  const activityLog: any = { log: jest.fn() };
  const service = new CorporateService(prisma, activityLog);
  return { service, prisma, activityLog };
}

describe('CorporateService (P4.4)', () => {
  it('добавление участника: клиент чужой точки не находится', async () => {
    const { service, prisma } = makeService();
    prisma.corporateAccount.findFirst.mockResolvedValue({ id: 'corp1', name: 'Ромашка' });
    prisma.client.findFirst.mockResolvedValue(null);

    await expect(service.addMember(ACTOR, 'corp1', { clientId: 'client1' })).rejects.toThrow(NotFoundException);
  });

  it('добавление участника: дубль — Conflict', async () => {
    const { service, prisma } = makeService();
    prisma.corporateAccount.findFirst.mockResolvedValue({ id: 'corp1', name: 'Ромашка' });
    prisma.client.findFirst.mockResolvedValue({ id: 'client1', name: 'Иван' });
    prisma.corporateMember.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(service.addMember(ACTOR, 'corp1', { clientId: 'client1' })).rejects.toThrow(ConflictException);
  });

  it('исключение не-участника — NotFound', async () => {
    const { service, prisma } = makeService();
    prisma.corporateMember.findFirst.mockResolvedValue(null);

    await expect(service.removeMember(ACTOR, 'corp1', 'client1')).rejects.toThrow(NotFoundException);
  });

  it('договор с заказами не удаляется', async () => {
    const { service, prisma } = makeService();
    prisma.corporateAccount.findFirst.mockResolvedValue({ id: 'corp1', name: 'Ромашка', _count: { orders: 2 } });

    await expect(service.remove({ ...ACTOR, role: 'CEO' as Role }, 'corp1')).rejects.toThrow(ConflictException);
    expect(prisma.corporateAccount.delete).not.toHaveBeenCalled();
  });

  it('ведомость считает только оплаченные заказы участников', async () => {
    const { service, prisma } = makeService();
    prisma.corporateAccount.findFirst.mockResolvedValue({ id: 'corp1', name: 'Ромашка', discountPercent: 10, isActive: true });
    prisma.order.findMany.mockResolvedValue([
      { id: 'o1', totalAmount: 2700, discount: 300, paidAt: new Date(), client: { name: 'Иван' }, lines: [{ type: 'MEMBERSHIP_PURCHASE', amount: 3000 }] },
      { id: 'o2', totalAmount: 900, discount: 100, paidAt: new Date(), client: { name: 'Пётр' }, lines: [] },
    ]);

    const result = await service.statement(ACTOR, 'corp1');

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { corporateAccountId: 'corp1', status: 'PAID' } }),
    );
    expect(result.count).toBe(2);
    expect(result.totalRub).toBe(3600);
  });
});
