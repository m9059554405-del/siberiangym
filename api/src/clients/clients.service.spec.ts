import { BadRequestException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { ClientsService } from './clients.service';

// P0.2 (хвост): регистрация больше не активирует абонемент напрямую.
// Начальная покупка оформляется обычным заказом (MEMBERSHIP_PURCHASE →
// AWAITING_PAYMENT наличными), абонемент создастся только после чека;
// несовершеннолетним без согласий представителя заказ не создаётся (P0.6).

const ACTOR = { sub: 'staff1', gymId: 'gym1', role: 'STAFF' as Role };

function makeService() {
  const prisma: any = {
    client: { create: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    gym: { findUniqueOrThrow: jest.fn().mockResolvedValue({ selfTrainingMinAge: 18 }) },
    $transaction: jest.fn(),
  };
  const activityLog: any = { log: jest.fn() };
  const auth: any = {};
  const email: any = { send: jest.fn() };
  const gyms: any = { resolveNetworkId: jest.fn() };
  const orders: any = { createOrder: jest.fn(), submitCash: jest.fn() };
  const service = new ClientsService(prisma, activityLog, auth, email, gyms, orders);
  return { service, prisma, orders };
}

function dtoFixture(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Иван',
    gender: 'M',
    birthday: '1990-01-01',
    phone: null,
    email: null,
    trainerId: null,
    tariff: null,
    membershipType: 'MONTHLY',
    ...overrides,
  };
}

describe('ClientsService.create (P0.2: абонемент заказом на кассе)', () => {
  it('совершеннолетнему абонемент оформляется заказом и отправляется на оплату', async () => {
    const { service, prisma, orders } = makeService();
    prisma.client.create.mockResolvedValue({ id: 'client1', name: 'Иван', membership: null, birthday: new Date('1990-01-01') });
    orders.createOrder.mockResolvedValue({ id: 'order1' });
    orders.submitCash.mockResolvedValue({ id: 'order1', status: 'AWAITING_PAYMENT', totalAmount: 3000 });

    const result = await service.create(ACTOR, dtoFixture() as never);

    // Карточка создаётся БЕЗ вложенного membership — прямого пути
    // активации абонемента больше нет.
    const createArg = prisma.client.create.mock.calls[0][0];
    expect('membership' in createArg.data).toBe(false);
    expect(createArg.data.formatHistory).toBeDefined();

    expect(orders.createOrder).toHaveBeenCalledWith(
      ACTOR,
      expect.objectContaining({
        clientId: 'client1',
        lines: [{ type: 'MEMBERSHIP_PURCHASE', meta: { membershipType: 'MONTHLY', scope: 'SINGLE_GYM' } }],
      }),
    );
    expect(orders.submitCash).toHaveBeenCalledWith(ACTOR, 'order1');
    expect(result.pendingOrder).toEqual(expect.objectContaining({ id: 'order1', status: 'AWAITING_PAYMENT' }));
  });

  it('несовершеннолетнему с тренером карточка создаётся, но заказ не оформляется', async () => {
    const { service, prisma, orders } = makeService();
    prisma.client.create.mockResolvedValue({ id: 'client2', name: 'Малой', membership: null, birthday: new Date('2012-01-01') });

    const result = await service.create(ACTOR, dtoFixture({ birthday: '2012-01-01', trainerId: 'trainer1', tariff: 'BASIC' }) as never);

    expect(prisma.client.create).toHaveBeenCalled();
    expect(orders.createOrder).not.toHaveBeenCalled();
    expect(result.pendingOrder).toBeNull();
  });

  it('несовершеннолетний без тренера не регистрируется', async () => {
    const { service, prisma } = makeService();
    await expect(service.create(ACTOR, dtoFixture({ birthday: '2012-01-01' }) as never)).rejects.toThrow(BadRequestException);
    expect(prisma.client.create).not.toHaveBeenCalled();
  });
});
