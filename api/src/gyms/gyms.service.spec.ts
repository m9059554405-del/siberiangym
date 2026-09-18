import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { Role } from '@prisma/client';
import { GymsService } from './gyms.service';

// P3.9: деактивация логина администратора — без удаления User и истории,
// с немедленным отзывом токенов (P3.8). Только STAFF и только своей сети.

function makeService(user: unknown) {
  const prisma: any = {
    gym: { findUniqueOrThrow: jest.fn().mockResolvedValue({ networkId: 'net1' }) },
    network: { findUnique: jest.fn().mockResolvedValue({ id: 'net1', ownerId: 'owner1' }) },
    user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
  };
  const activityLog: any = { log: jest.fn() };
  return { service: new GymsService(prisma, activityLog), prisma, activityLog };
}

const ACTOR = { sub: 'owner1', gymId: 'gym1', role: 'CEO' as Role };

function staffFixture(overrides: Record<string, unknown> = {}) {
  return { id: 'staff1', role: 'STAFF', gymId: 'gym1', isActive: true, gym: { networkId: 'net1' }, name: 'Мария', email: 'm@x.ru', ...overrides };
}

describe('GymsService.setStaffActive (P3.9)', () => {
  it('деактивация поднимает sessionVersion и пишет activity-log', async () => {
    const { service, prisma, activityLog } = makeService(staffFixture());
    prisma.user.update.mockResolvedValue(staffFixture({ isActive: false }));

    const result = await service.setStaffActive(ACTOR, 'staff1', false);

    expect(result.isActive).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: false, sessionVersion: { increment: 1 } } }));
    expect(activityLog.log).toHaveBeenCalledWith(expect.anything(), 'Деактивировал логин администратора', 'Мария', expect.any(String));
  });

  it('реактивация разрешена тем же эндпоинтом', async () => {
    const { service, prisma } = makeService(staffFixture({ isActive: false }));
    prisma.user.update.mockResolvedValue(staffFixture({ isActive: true }));

    await service.setStaffActive(ACTOR, 'staff1', true);

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { isActive: true, sessionVersion: { increment: 1 } } }));
  });

  it('CEO и TRAINER логины деактивировать через этот инструмент нельзя', async () => {
    const { service } = makeService(staffFixture({ role: 'CEO' }));
    await expect(service.setStaffActive(ACTOR, 'ceo1', false)).rejects.toThrow(BadRequestException);
  });

  it('администратор чужой сети — не найден', async () => {
    const { service } = makeService(staffFixture({ gym: { networkId: 'other-net' } }));
    await expect(service.setStaffActive(ACTOR, 'staff1', false)).rejects.toThrow(NotFoundException);
  });

  it('повторная деактивация уже деактивированного — идемпотентна, без записи в журнал', async () => {
    const { service, prisma, activityLog } = makeService(staffFixture({ isActive: false }));
    const result = await service.setStaffActive(ACTOR, 'staff1', false);

    expect(result.isActive).toBe(false);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(activityLog.log).not.toHaveBeenCalled();
  });
});
