import { StockService } from './stock.service';

// P3.13: инвентаризация читает все партии одним запросом (без N+1) и
// применяет корректировки одной транзакцией; недостача уходит по FEFO.

function makeService() {
  const prisma: any = {
    stockBatch: {
      findMany: jest.fn(),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    inventoryCount: { create: jest.fn() },
    $transaction: jest.fn(),
    catalogItem: { findFirst: jest.fn() },
  };
  const activityLog: any = { log: jest.fn() };
  return { service: new StockService(prisma, activityLog), prisma, activityLog };
}

const ACTOR = { sub: 'staff1', gymId: 'gym1', role: 'STAFF' as const };

function batch(id: string, qty: number, expiresAt: Date) {
  return { id, catalogItemId: 'item1', location: 'SHELF' as const, quantity: qty, expiresAt, gymId: 'gym1', receivedAt: new Date() };
}

describe('StockService.finalizeInventory (P3.13)', () => {
  it('читает партии всех позиций одним findMany', async () => {
    const { service, prisma } = makeService();
    prisma.stockBatch.findMany.mockResolvedValue([batch('b1', 5, new Date('2026-10-01')), batch('b2', 3, new Date('2026-11-01'))]);
    prisma.$transaction.mockImplementation(async (fn: unknown) =>
      typeof fn === 'function' ? (fn as (tx: unknown) => Promise<unknown>)(prisma) : Promise.resolve(fn),
    );
    prisma.inventoryCount.create.mockResolvedValue({ id: 'count1', entries: [] });

    await service.finalizeInventory(ACTOR, {
      entries: [
        { catalogItemId: 'item1', location: 'SHELF', countedQty: 10 },
        { catalogItemId: 'item1', location: 'WAREHOUSE', countedQty: 0 },
      ],
    } as never);

    expect(prisma.stockBatch.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.stockBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gymId: 'gym1',
          OR: [{ catalogItemId: 'item1', location: 'SHELF' }, { catalogItemId: 'item1', location: 'WAREHOUSE' }],
        }),
      }),
    );
  });

  it('недостача списывается по FEFO из уже прочитанных партий одной транзакцией', async () => {
    const { service, prisma } = makeService();
    // systemQty = 5+3 = 8, посчитали 6 → недостача 2 уходит из самой ранней партии b1 (5 → 3)
    prisma.stockBatch.findMany.mockResolvedValue([batch('b1', 5, new Date('2026-10-01')), batch('b2', 3, new Date('2026-11-01'))]);
    prisma.$transaction.mockImplementation(async (fn: unknown) =>
      typeof fn === 'function' ? (fn as (tx: unknown) => Promise<unknown>)(prisma) : Promise.resolve(fn),
    );
    prisma.inventoryCount.create.mockResolvedValue({ id: 'count1', entries: [] });

    await service.finalizeInventory(ACTOR, { entries: [{ catalogItemId: 'item1', location: 'SHELF', countedQty: 6 }] } as never);

    expect(prisma.stockBatch.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { quantity: 3 } });
    expect(prisma.stockBatch.update).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('излишек оформляется новой партией, без списаний', async () => {
    const { service, prisma } = makeService();
    prisma.stockBatch.findMany.mockResolvedValue([batch('b1', 5, new Date('2026-10-01'))]);
    prisma.$transaction.mockImplementation(async (fn: unknown) =>
      typeof fn === 'function' ? (fn as (tx: unknown) => Promise<unknown>)(prisma) : Promise.resolve(fn),
    );
    prisma.inventoryCount.create.mockResolvedValue({ id: 'count1', entries: [] });

    await service.finalizeInventory(ACTOR, { entries: [{ catalogItemId: 'item1', location: 'SHELF', countedQty: 9 }] } as never);

    expect(prisma.stockBatch.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ quantity: 4 }) }));
    expect(prisma.stockBatch.update).not.toHaveBeenCalled();
  });
});
