import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { CleaningService } from './cleaning.service';

// P4.2: зоны уборки — настройка точки, а не глобальная константа из
// демо-версии. Чек-лист фиксирует текущий набор зон; зона с историей
// не удаляется (FK Restrict), только переименовывается.

const ACTOR = { sub: 'ceo1', gymId: 'gym1', role: 'CEO' as Role };

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma: any = {
    cleaningZone: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      ...((overrides.cleaningZone ?? {}) as Record<string, unknown>),
    },
    cleaningChecklist: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    cleaningChecklistItem: { count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    ...((overrides.prisma ?? {}) as Record<string, unknown>),
  };
  const activityLog: any = { log: jest.fn() };
  return { service: new CleaningService(prisma, activityLog), prisma, activityLog };
}

describe('CleaningService.create (P4.2)', () => {
  it('чек-лист создаётся из текущего набора зон точки в их порядке', async () => {
    const zones = [
      { id: 'z1', gymId: 'gym1', name: 'Пол', position: 0 },
      { id: 'z2', gymId: 'gym1', name: 'Зеркала', position: 1 },
    ];
    const { service, prisma } = makeService({ cleaningZone: { findMany: jest.fn().mockResolvedValue(zones) } });
    prisma.cleaningChecklist.create.mockImplementation(({ data }: any) => ({ id: 'c1', ...data }));

    await service.create(ACTOR, { date: '2026-09-19', responsibleName: 'Мария' });

    expect(prisma.cleaningChecklist.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [{ zoneId: 'z1', done: false }, { zoneId: 'z2', done: false }] },
        }),
      }),
    );
  });

  it('без настроенных зон чек-лист не создаётся', async () => {
    const { service } = makeService();

    await expect(service.create(ACTOR, { date: '2026-09-19', responsibleName: 'Мария' })).rejects.toThrow(BadRequestException);
  });
});

describe('CleaningService.toggleItem (P4.2)', () => {
  it('переключение по zoneId пишет в журнал название зоны', async () => {
    const { service, prisma, activityLog } = makeService();
    prisma.cleaningChecklist.findFirst.mockResolvedValue({ id: 'c1', gymId: 'gym1', date: new Date('2026-09-19') });
    prisma.cleaningChecklistItem.findUnique.mockResolvedValue({ id: 'i1', zoneId: 'z1', done: false, zone: { name: 'Санузлы' } });
    prisma.cleaningChecklistItem.update.mockResolvedValue({ id: 'i1', done: true });

    const result = await service.toggleItem(ACTOR, 'c1', 'z1');

    expect(result.done).toBe(true);
    expect(prisma.cleaningChecklistItem.findUnique).toHaveBeenCalledWith({ where: { checklistId_zoneId: { checklistId: 'c1', zoneId: 'z1' } }, include: { zone: true } });
    expect(activityLog.log).toHaveBeenCalledWith(expect.anything(), 'Отметил уборку выполненной', '2026-09-19', 'Санузлы');
  });
});

describe('CleaningService zones CRUD (P4.2)', () => {
  it('создание зоны с существующим названием — Conflict', async () => {
    const { service, prisma } = makeService();
    prisma.cleaningZone.findFirst.mockResolvedValue(null);
    prisma.cleaningZone.create.mockRejectedValue({ code: 'P2002' });

    await expect(service.createZone(ACTOR, { name: 'Пол' })).rejects.toThrow(ConflictException);
  });

  it('новая зона получает позицию после последней', async () => {
    const { service, prisma } = makeService();
    prisma.cleaningZone.findFirst.mockResolvedValue({ position: 6 });
    prisma.cleaningZone.create.mockResolvedValue({ id: 'z8', name: 'Бассейн', position: 7 });

    await service.createZone(ACTOR, { name: 'Бассейн' });

    expect(prisma.cleaningZone.create).toHaveBeenCalledWith({ data: { gymId: 'gym1', name: 'Бассейн', position: 7 } });
  });

  it('зона с историей чек-листов не удаляется', async () => {
    const { service, prisma } = makeService();
    prisma.cleaningZone.findFirst.mockResolvedValue({ id: 'z1', gymId: 'gym1', name: 'Пол' });
    prisma.cleaningChecklistItem.count.mockResolvedValue(12);

    await expect(service.removeZone(ACTOR, 'z1')).rejects.toThrow(ConflictException);
    expect(prisma.cleaningZone.delete).not.toHaveBeenCalled();
  });

  it('неиспользуемая зона удаляется', async () => {
    const { service, prisma } = makeService();
    prisma.cleaningZone.findFirst.mockResolvedValue({ id: 'z2', gymId: 'gym1', name: 'Окна' });
    prisma.cleaningChecklistItem.count.mockResolvedValue(0);

    await service.removeZone(ACTOR, 'z2');

    expect(prisma.cleaningZone.delete).toHaveBeenCalledWith({ where: { id: 'z2' } });
  });

  it('чужая зона (другой точки) — не найдена', async () => {
    const { service } = makeService();

    await expect(service.removeZone(ACTOR, 'z-other')).rejects.toThrow(/Зона не найдена/);
  });
});
