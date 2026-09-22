import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { HallsService } from './halls.service';

// Заявка клуба: залы внутри точки. Ключевые инварианты — точка без зала
// существовать не может (удаление последнего зала запрещено) и в зал
// нельзя привязать тренера, не работающего на этой точке.

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma: any = {
    hall: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    trainer: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    ...prismaOverrides,
  };
  const gyms: any = { assertBelongsToOwnedNetwork: jest.fn().mockResolvedValue(undefined) };
  const activityLog: any = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new HallsService(prisma, gyms, activityLog), prisma, gyms };
}

const ACTOR = { sub: 'ceo1', gymId: 'gym1', role: 'CEO' as const };

describe('HallsService', () => {
  it('создаёт зал с тренерами и ценами в одной операции', async () => {
    const { service, prisma } = makeService();
    prisma.trainer.findMany.mockResolvedValue([
      { id: 't1', name: 'Тренер', gymId: 'gym1', additionalGyms: [] },
    ]);
    prisma.hall.create.mockResolvedValue({ id: 'h1' });

    await service.create(ACTOR, {
      gymId: 'gym1',
      name: 'Зал единоборств',
      kind: 'Зал единоборств',
      trainerIds: ['t1'],
      prices: [{ label: 'Час аренды', amount: 1000 }],
    });

    expect(prisma.hall.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gymId: 'gym1',
        name: 'Зал единоборств',
        trainers: { create: [{ trainerId: 't1' }] },
        prices: { create: [{ label: 'Час аренды', amount: 1000 }] },
      }),
      include: expect.anything(),
    });
  });

  it('тренер с другой точки не привязывается к залу', async () => {
    const { service, prisma } = makeService();
    prisma.trainer.findMany.mockResolvedValue([
      { id: 't1', name: 'Чужой тренер', gymId: 'gym2', additionalGyms: [] },
    ]);

    await expect(
      service.create(ACTOR, { gymId: 'gym1', name: 'Зал тенниса', kind: 'Зал тенниса', trainerIds: ['t1'] }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.hall.create).not.toHaveBeenCalled();
  });

  it('тренер с дополнительной точкой привязывается', async () => {
    const { service, prisma } = makeService();
    prisma.trainer.findMany.mockResolvedValue([
      { id: 't1', name: 'Тренер', gymId: 'gym2', additionalGyms: [{ gymId: 'gym1' }] },
    ]);
    prisma.hall.create.mockResolvedValue({ id: 'h1' });

    await expect(
      service.create(ACTOR, { gymId: 'gym1', name: 'Зал тенниса', kind: 'Зал тенниса', trainerIds: ['t1'] }),
    ).resolves.toBeDefined();
  });

  it('несуществующий зал — NotFound', async () => {
    const { service } = makeService();
    await expect(service.remove(ACTOR, 'missing')).rejects.toThrow(NotFoundException);
  });

  it('последний зал точки удалить нельзя', async () => {
    const { service, prisma } = makeService();
    prisma.hall.findUnique.mockResolvedValue({ id: 'h1', gymId: 'gym1', name: 'Зал', kind: 'Зал' });
    prisma.hall.count.mockResolvedValue(1);

    await expect(service.remove(ACTOR, 'h1')).rejects.toThrow(ConflictException);
    expect(prisma.hall.delete).not.toHaveBeenCalled();
  });

  it('не-последний зал удаляется', async () => {
    const { service, prisma } = makeService();
    prisma.hall.findUnique.mockResolvedValue({ id: 'h1', gymId: 'gym1', name: 'Зал', kind: 'Зал' });
    prisma.hall.count.mockResolvedValue(2);
    prisma.hall.delete.mockResolvedValue({ id: 'h1' });

    await expect(service.remove(ACTOR, 'h1')).resolves.toEqual({ ok: true });
    expect(prisma.hall.delete).toHaveBeenCalledWith({ where: { id: 'h1' } });
  });

  it('обновление заменяет набор цен и тренеров целиком', async () => {
    const { service, prisma } = makeService();
    prisma.hall.findUnique.mockResolvedValue({ id: 'h1', gymId: 'gym1', name: 'Зал', kind: 'Зал' });
    prisma.trainer.findMany.mockResolvedValue([{ id: 't2', name: 'Тренер 2', gymId: 'gym1', additionalGyms: [] }]);
    prisma.hall.update.mockResolvedValue({ id: 'h1' });

    await service.update(ACTOR, 'h1', {
      name: 'Тренажерный зал A',
      trainerIds: ['t2'],
      prices: [{ label: 'Час аренды', amount: 1200 }],
    });

    expect(prisma.hall.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'h1' },
        data: expect.objectContaining({
          trainers: { deleteMany: {}, create: [{ trainerId: 't2' }] },
          prices: { deleteMany: {}, create: [{ label: 'Час аренды', amount: 1200 }] },
        }),
      }),
    );
  });
});
