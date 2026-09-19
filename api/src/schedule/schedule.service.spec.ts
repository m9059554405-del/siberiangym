import { BadRequestException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { ScheduleService } from './schedule.service';

// P4.2: часы работы точки ограничивают создание занятий/слотов и генерацию
// серий. День без записи в gym_working_hours — ограничений нет (обратная
// совместимость с точками, созданными до P4.2).

const ACTOR = { sub: 'ceo1', gymId: 'gym1', role: 'CEO' as Role };
const TRAINER = { id: 't1', name: 'Анна', departedAt: null, unavailableFrom: null, unavailableUntil: null };

function makeService(hours: { weekday: number; open: string; close: string }[]) {
  const tx: any = {
    $queryRaw: jest.fn(),
    personalSlot: { findMany: jest.fn().mockResolvedValue([]) },
    groupClass: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({ id: 'gc1' }) },
    trainer: { findUnique: jest.fn().mockResolvedValue(TRAINER) },
    gymWorkingHours: { findMany: jest.fn().mockResolvedValue(hours) },
  };
  const prisma: any = {
    gymWorkingHours: { findMany: jest.fn().mockResolvedValue(hours) },
    groupClass: { findMany: jest.fn().mockResolvedValue([]) },
    groupClassSeries: { create: jest.fn() },
    personalSlot: { create: jest.fn().mockResolvedValue({ id: 'slot1' }) },
    $transaction: jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx)),
    ...tx,
  };
  const activityLog: any = { log: jest.fn() };
  const trainers: any = { assertTrainerAtGym: jest.fn().mockResolvedValue(TRAINER) };
  const gyms: any = { resolveNetworkGymIds: jest.fn() };
  const email: any = { send: jest.fn() };
  const notifications: any = { notify: jest.fn() };
  const service = new ScheduleService(prisma, activityLog, trainers, gyms, email, notifications);
  return { service, prisma, tx };
}

// 2026-09-22 — вторник (weekdayIndex = 1).
const TUESDAY = '2026-09-22';

describe('ScheduleService: часы работы точки (P4.2)', () => {
  it('занятие вне часов работы отклоняется', async () => {
    const { service } = makeService([{ weekday: 1, open: '10:00', close: '22:00' }]);

    await expect(
      service.createGroupClass(ACTOR, { trainerId: 't1', type: 'Йога', date: TUESDAY, start: '21:00', end: '23:00' } as never),
    ).rejects.toThrow(/Вне часов работы зала/);
  });

  it('занятие в пределах часов создаётся', async () => {
    const { service, tx } = makeService([{ weekday: 1, open: '10:00', close: '22:00' }]);

    await service.createGroupClass(ACTOR, { trainerId: 't1', type: 'Йога', date: TUESDAY, start: '18:00', end: '19:00' } as never);

    expect(tx.groupClass.create).toHaveBeenCalled();
  });

  it('день без записи в часах — ограничений нет', async () => {
    const { service, tx } = makeService([]);

    await service.createGroupClass(ACTOR, { trainerId: 't1', type: 'Йога', date: TUESDAY, start: '06:00', end: '07:00' } as never);

    expect(tx.groupClass.create).toHaveBeenCalled();
  });

  it('персональный слот вне часов работы отклоняется', async () => {
    const { service } = makeService([{ weekday: 1, open: '10:00', close: '22:00' }]);

    await expect(
      service.createPersonalSlot(ACTOR, { trainerId: 't1', date: TUESDAY, start: '09:00', end: '10:00' } as never),
    ).rejects.toThrow(/Вне часов работы зала/);
  });

  it('генератор серий пропускает дату вне часов работы с причиной, не роняя серию', async () => {
    const { service, prisma, tx } = makeService([{ weekday: 1, open: '10:00', close: '22:00' }]);
    prisma.groupClassSeries.create.mockResolvedValue({
      id: 's1', gymId: 'gym1', type: 'Йога', trainerId: 't1', zone: 'Зал 1',
      start: '22:30', end: '23:15', capacity: 10, weekdays: [1],
      startDate: new Date('2026-09-19'), endDate: null, horizonDays: 14,
    });

    const result = await service.createSeries(ACTOR, {
      trainerId: 't1', type: 'Йога', zone: 'Зал 1', start: '22:30', end: '23:15',
      capacity: 10, weekdays: [1], startDate: '2026-09-19', horizonDays: 14,
    } as never);

    expect(result.generation.created).toEqual([]);
    expect(result.generation.skipped.length).toBeGreaterThan(0);
    expect(result.generation.skipped[0].reason).toMatch(/Вне часов работы зала/);
    expect(tx.groupClass.create).not.toHaveBeenCalled();
  });
});
