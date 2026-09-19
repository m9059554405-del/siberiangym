import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { OrdersService } from './orders.service';

// P3.1: юнит-тесты OrdersService с моком Prisma — денежные guard'ы
// подтверждения чека (P0.2). Happy-path (полное применение позиций в
// транзакции БД) — территория e2e против реальной базы; здесь проверяем,
// что некорректные оплаты не доходят до транзакции и не создают записей.

function makeService() {
  const prisma: any = {
    order: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    client: { findFirst: jest.fn() },
    catalogItem: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const activityLog: any = { log: jest.fn() };
  const email: any = { send: jest.fn() };
  const notifications: any = { notify: jest.fn() };
  const acquiring: any = { isConfigured: () => false, createPayment: jest.fn() };
  const service = new OrdersService(prisma, activityLog, email, notifications, acquiring);
  return { service, prisma, activityLog };
}

const ACTOR = { sub: 'staff1', gymId: 'gym1', role: 'STAFF' as Role };
const QR = 't=20260914T1530&s=1500.00&fn=fn1&i=1&fp=2';

function orderFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order1',
    gymId: 'gym1',
    clientId: 'client1',
    createdBy: 'staff1',
    status: 'AWAITING_PAYMENT',
    paymentMethod: 'CASH',
    totalAmount: 1500,
    expiresAt: new Date(Date.now() + 60_000),
    lines: [{ id: 'l1', orderId: 'order1', type: 'STOCK_PURCHASE', refId: 'item1', amount: 1500, meta: {} }],
    client: { id: 'client1', name: 'Иван', email: null, userId: 'user1' },
    ...overrides,
  };
}

describe("OrdersService.confirmReceipt (денежные guard'ы P0.2)", () => {
  it('сумма чека не совпала — BadRequest, транзакция не запускается', async () => {
    const { service, prisma } = makeService();
    prisma.order.findFirst.mockResolvedValue(orderFixture());
    prisma.order.findUnique.mockResolvedValue(null); // чек ещё не использован

    await expect(service.confirmReceipt(ACTOR, 'order1', 't=20260914T1530&s=1499.00&fn=fn1&i=1&fp=2')).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('чек уже привязан к другому заказу — Conflict + запись в журнал', async () => {
    const { service, prisma, activityLog } = makeService();
    prisma.order.findFirst.mockResolvedValue(orderFixture());
    prisma.order.findUnique.mockResolvedValue(orderFixture({ id: 'other-order' }));

    await expect(service.confirmReceipt(ACTOR, 'order1', QR)).rejects.toThrow(ConflictException);
    expect(activityLog.log).toHaveBeenCalledWith(expect.anything(), 'Подозрение: повторное использование чека', 'Иван', expect.stringContaining('fn1'));
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('тот же чек у этого же заказа (повторный скан) — не считается повторным использованием', async () => {
    const { service, prisma } = makeService();
    prisma.order.findFirst.mockResolvedValue(orderFixture({ totalAmount: 1501 }));
    prisma.order.findUnique.mockResolvedValue(orderFixture());

    await expect(service.confirmReceipt(ACTOR, 'order1', QR)).rejects.toThrow(/Сумма чека/);
  });

  it('онлайн-заказ нельзя закрыть бумажным чеком', async () => {
    const { service, prisma } = makeService();
    prisma.order.findFirst.mockResolvedValue(orderFixture({ paymentMethod: 'CARD_ONLINE' }));

    await expect(service.confirmReceipt(ACTOR, 'order1', QR)).rejects.toThrow(/закроется автоматически/);
  });

  it('черновик сначала нужно отправить на оплату', async () => {
    const { service, prisma } = makeService();
    prisma.order.findFirst.mockResolvedValue(orderFixture({ status: 'DRAFT', paymentMethod: null }));

    await expect(service.confirmReceipt(ACTOR, 'order1', QR)).rejects.toThrow(/не ожидает оплаты/);
  });

  it('просроченный заказ помечается EXPIRED и отклоняется', async () => {
    const { service, prisma } = makeService();
    prisma.order.findFirst.mockResolvedValue(orderFixture({ expiresAt: new Date(Date.now() - 1000) }));

    await expect(service.confirmReceipt(ACTOR, 'order1', QR)).rejects.toThrow(/истекло/);
    expect(prisma.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order1', status: 'AWAITING_PAYMENT' }, data: expect.objectContaining({ status: 'EXPIRED' }) }),
    );
  });

  it('не-чек (нет полей ФНС) отклоняется до обращения к БД чеков', async () => {
    const { service, prisma } = makeService();
    prisma.order.findFirst.mockResolvedValue(orderFixture());

    await expect(service.confirmReceipt(ACTOR, 'order1', 'https://example.com/nope')).rejects.toThrow(/не похоже на QR-код/);
    expect(prisma.order.findUnique).not.toHaveBeenCalled();
  });
});

describe('OrdersService.createOrder', () => {
  const line = (refId: string) => ({ type: 'STOCK_PURCHASE', refId, meta: {} });

  it('покупка абонемента берёт цену из настроек точки, а не из клиента', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('1990-01-01') });
    prisma.gym = { findUniqueOrThrow: jest.fn().mockResolvedValue({ selfTrainingMinAge: 18 }) };
    prisma.membershipPricing = { findUnique: jest.fn().mockResolvedValue({ single: 500, monthly: 3000, pack10: 4500, pack20: 8000 }) };
    prisma.membership = { findUnique: jest.fn().mockResolvedValue(null) };
    prisma.order.create.mockResolvedValue({ id: 'created' });

    await service.createOrder(ACTOR, {
      clientId: 'client1',
      lines: [{ type: 'MEMBERSHIP_PURCHASE', meta: { membershipType: 'MONTHLY', scope: 'SINGLE_GYM' } }],
    } as never);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalAmount: 3000,
          lines: { create: [expect.objectContaining({ type: 'MEMBERSHIP_PURCHASE', amount: 3000, meta: { membershipType: 'MONTHLY', scope: 'SINGLE_GYM' } })] },
        }),
      }),
    );
  });

  it('повторная покупка существующего абонемента становится продлением', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('1990-01-01') });
    prisma.gym = { findUniqueOrThrow: jest.fn().mockResolvedValue({ selfTrainingMinAge: 18 }) };
    prisma.membershipPricing = { findUnique: jest.fn().mockResolvedValue({ monthly: 3000 }) };
    prisma.membership = { findUnique: jest.fn().mockResolvedValue({ id: 'membership1' }) };
    prisma.order.create.mockResolvedValue({ id: 'created' });

    await service.createOrder(ACTOR, {
      clientId: 'client1',
      lines: [{ type: 'MEMBERSHIP_PURCHASE', meta: { membershipType: 'MONTHLY' } }],
    } as never);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lines: { create: [expect.objectContaining({ type: 'MEMBERSHIP_RENEWAL' })] } }) }),
    );
  });

  it('запись на групповое занятие берёт цену точки и проверяет вместимость', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('1990-01-01') });
    prisma.gym = { findUniqueOrThrow: jest.fn().mockResolvedValue({ selfTrainingMinAge: 18 }) };
    prisma.groupClass = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'class1', trainerId: 'trainer1', capacity: 10, bookings: [], date: new Date('2026-09-20'), start: '18:00', end: '19:00',
      }),
    };
    prisma.personalSlot = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.groupClassBooking = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.membershipPricing = { findUnique: jest.fn().mockResolvedValue({ groupSingle: 700 }) };
    prisma.order.create.mockResolvedValue({ id: 'created' });

    await service.createOrder(ACTOR, {
      clientId: 'client1', lines: [{ type: 'GROUP_CLASS_BOOKING', refId: 'class1', meta: {} }],
    } as never);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 700, lines: { create: [expect.objectContaining({ type: 'GROUP_CLASS_BOOKING', refId: 'class1', amount: 700 })] } }) }),
    );
  });

  it('переполненное групповое занятие отклоняется до создания заказа', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('1990-01-01') });
    prisma.gym = { findUniqueOrThrow: jest.fn().mockResolvedValue({ selfTrainingMinAge: 18 }) };
    prisma.groupClass = {
      findFirst: jest.fn().mockResolvedValue({ id: 'class1', capacity: 1, bookings: [{ clientId: 'other' }] }),
    };

    await expect(service.createOrder(ACTOR, {
      clientId: 'client1', lines: [{ type: 'GROUP_CLASS_BOOKING', refId: 'class1', meta: {} }],
    } as never)).rejects.toThrow(/Мест не осталось/);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('сумма заказа = сумма позиций (ценовой снапшот)', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue({ id: 'client1', userId: 'user1', name: 'Иван' });
    prisma.catalogItem.findFirst.mockImplementation((args: { where: { id: string } }) =>
      Promise.resolve(args.where.id === 'item1' ? { id: 'item1', price: 150 } : { id: 'item2', price: 200 }),
    );
    prisma.order.create.mockResolvedValue({ id: 'created' });

    await service.createOrder(ACTOR, { clientId: 'client1', lines: [line('item1'), line('item2'), line('item1')] } as never);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ gymId: 'gym1', totalAmount: 150 + 200 + 150, status: 'DRAFT' }),
      }),
    );
  });

  // P0.6 (хвост): запись несовершеннолетнего на занятия требует допуска
  // законного представителя — ACTIVITY_WAIVER_MINOR_GUARDIAN.
  function minorMocks(prisma: any, opts: { guardian: boolean; waiver: boolean }) {
    prisma.gym = { findUniqueOrThrow: jest.fn().mockResolvedValue({ selfTrainingMinAge: 18 }) };
    prisma.guardianChild = { findMany: jest.fn().mockResolvedValue(opts.guardian ? [{ guardianId: 'g1' }] : []) };
    prisma.consentRecord = {
      findMany: jest.fn().mockResolvedValue(opts.waiver ? [{ type: 'ACTIVITY_WAIVER_MINOR_GUARDIAN', granted: true }] : []),
    };
  }

  it('несовершеннолетний без представителя не записывается на групповое занятие', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('2012-01-01') });
    minorMocks(prisma, { guardian: false, waiver: false });

    await expect(service.createOrder(ACTOR, {
      clientId: 'client1', lines: [{ type: 'GROUP_CLASS_BOOKING', refId: 'class1', meta: {} }],
    } as never)).rejects.toThrow(BadRequestException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('несовершеннолетний с представителем, но без допуска к занятиям — отказ', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('2012-01-01') });
    minorMocks(prisma, { guardian: true, waiver: false });

    await expect(service.createOrder(ACTOR, {
      clientId: 'client1', lines: [{ type: 'PERSONAL_SLOT_BOOKING', refId: 'slot1', meta: {} }],
    } as never)).rejects.toThrow(/согласий законного представителя/);
  });

  it('несовершеннолетний с подписанным допуском записывается на групповое занятие', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('2012-01-01') });
    minorMocks(prisma, { guardian: true, waiver: true });
    prisma.groupClass = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'class1', trainerId: 'trainer1', capacity: 10, bookings: [], date: new Date('2026-09-20'), start: '18:00', end: '19:00',
      }),
    };
    prisma.personalSlot = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.groupClassBooking = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.membershipPricing = { findUnique: jest.fn().mockResolvedValue({ groupSingle: 700 }) };
    prisma.order.create.mockResolvedValue({ id: 'created' });

    await service.createOrder(ACTOR, {
      clientId: 'client1', lines: [{ type: 'GROUP_CLASS_BOOKING', refId: 'class1', meta: {} }],
    } as never);

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ totalAmount: 700 }) }),
    );
  });

  it('совершеннолетний клиент проходит без проверок представителя', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst
      .mockResolvedValueOnce({ id: 'client1', userId: 'user1', name: 'Иван' })
      .mockResolvedValueOnce({ birthday: new Date('1990-01-01') });
    prisma.gym = { findUniqueOrThrow: jest.fn().mockResolvedValue({ selfTrainingMinAge: 18 }) };
    prisma.guardianChild = { findMany: jest.fn() };
    prisma.groupClass = {
      findFirst: jest.fn().mockResolvedValue({ id: 'class1', trainerId: 't1', capacity: 5, bookings: [] }),
    };
    prisma.membershipPricing = { findUnique: jest.fn().mockResolvedValue({ groupSingle: 700 }) };
    prisma.personalSlot = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.groupClassBooking = { findMany: jest.fn().mockResolvedValue([]) };
    prisma.order.create.mockResolvedValue({ id: 'created' });

    await service.createOrder(ACTOR, {
      clientId: 'client1', lines: [{ type: 'GROUP_CLASS_BOOKING', refId: 'class1', meta: {} }],
    } as never);

    expect(prisma.guardianChild.findMany).not.toHaveBeenCalled();
  });

  it('клиент может оформить заказ только на себя', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue({ id: 'client1', userId: 'someone-else', name: 'Иван' });
    const clientActor = { sub: 'user-client', gymId: 'gym1', role: 'CLIENT' as Role };

    await expect(service.createOrder(clientActor, { clientId: 'client1', lines: [line('item1')] } as never)).rejects.toThrow(ForbiddenException);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('заказ без позиций отклоняется', async () => {
    const { service, prisma } = makeService();
    prisma.client.findFirst.mockResolvedValue({ id: 'client1', userId: 'user1', name: 'Иван' });

    await expect(service.createOrder(ACTOR, { clientId: 'client1', lines: [] } as never)).rejects.toThrow(BadRequestException);
  });
});
