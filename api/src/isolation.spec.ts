import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrdersService } from './orders/orders.service';
import { TransactionsService } from './transactions/transactions.service';

// P4.1: изоляция независимых владельцев. Две несвязанные сети —
// «Сибирь» (gymA, owner-A) и «Чужая» (gymB, owner-B). Тест фиксирует
// контракт слоя данных: КАЖДЫЙ путь аудируемых сервисов обязан нести
// гим-скоуп в where (или проверять владение сетью) — чтение «по голому
// id» чужих клиентов/финансов невозможно по построению. Полный прогон
// против живой PostgreSQL с двумя Network — на staging (P3.20).

const GYM_A = 'gym-siberia';
const GYM_B = 'gym-foreign';

const staffA = { sub: 'staff-a', gymId: GYM_A, role: Role.STAFF };
const ceoA = { sub: 'owner-a', gymId: GYM_A, role: Role.CEO };

function foreignClient() {
  return { id: 'client-foreign', gymId: GYM_B, name: 'Чужой Клиент', userId: 'user-b' };
}

describe('Мультиарендная изоляция (P4.1)', () => {
  it('заказ чужой точки не находится: getOwnedOrder скопит по gymId токена', async () => {
    // Имитация БД: заказ order-foreign физически живёт в gymB — в gymA
    // строки с таким id нет, скопированный findFirst обязан вернуть null.
    const rows = [
      { id: 'order-a1', gymId: GYM_A, client: { userId: 'user-a', name: 'A' }, lines: [] },
      { id: 'order-foreign', gymId: GYM_B, client: { userId: 'user-b', name: 'B' }, lines: [] },
    ];
    const prisma: any = {
      order: {
        findFirst: jest.fn(({ where }: { where: { id: string; gymId: string } }) =>
          Promise.resolve(rows.find((r) => r.id === where.id && r.gymId === where.gymId) ?? null),
        ),
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
      },
      client: { findFirst: jest.fn() },
      catalogItem: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new OrdersService(prisma, { log: jest.fn() } as never, { send: jest.fn() } as never, { notify: jest.fn() } as never, { isConfigured: () => false } as never);

    await expect(service.findOne(staffA, 'order-foreign')).rejects.toThrow(NotFoundException);
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'order-foreign', gymId: GYM_A }) }));
  });

  it('выручка CEO отдаётся только по точкам его сети', async () => {
    const prisma: any = {
      transaction: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };
    const gyms: any = { resolveNetworkGymIds: jest.fn().mockResolvedValue([GYM_A]) };
    const service = new TransactionsService(prisma, gyms);

    const feed = await service.findAll(ceoA, {});

    expect(feed).toMatchObject({ items: [], total: 0, page: 1 });

    expect(gyms.resolveNetworkGymIds).toHaveBeenCalledWith(ceoA);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { gymId: { in: [GYM_A] } } }));
  });

  it('клиент чужой точки не находится ни чтением, ни созданием заказа', async () => {
    const prisma: any = {
      client: {
        findFirst: jest.fn(({ where }: { where: { id: string; gymId: string } }) =>
          Promise.resolve(where.gymId === GYM_A ? { id: where.id, gymId: GYM_A, userId: 'user-a', name: 'A' } : null),
        ),
      },
      order: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      catalogItem: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new OrdersService(prisma, { log: jest.fn() } as never, { send: jest.fn() } as never, { notify: jest.fn() } as never, { isConfigured: () => false } as never);

    await expect(
      service.createOrder(staffA, { clientId: 'client-foreign', lines: [{ type: 'STOCK_PURCHASE', refId: 'item1', meta: {} }] } as never),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.order.create).not.toHaveBeenCalled();
    expect(foreignClient().gymId).not.toBe(GYM_A); // фикстура самопроверки
  });
});
