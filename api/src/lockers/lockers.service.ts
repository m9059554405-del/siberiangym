import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { GymsService } from '../gyms/gyms.service';
import { CHECKIN_CODE_PREFIX } from '../checkins/checkins.service';
import { LockerControllerDriver } from './locker-controller.driver';
import type { JwtPayload } from '../auth/auth.service';
import type { Locker } from '@prisma/client';

// Киоск централизованного управления шкафчиками (P2.8). Один терминал со
// сканером QR на раздевалку/ряд: скан назначает свободный шкафчик или
// возвращает уже закреплённый (идемпотентно), повторный скан после
// открытия дверцы выдаёт вещи. QR переиспользуется от чек-ина (P2.2) —
// второго кода у клиента нет. Доступ к раздевалке ≠ доступ в зал:
// абонемент НЕ проверяется — клиент может забрать вещи и после
// истечения абонемента (развилка бэклога явно закрыта этим решением).
// Терминал авторизован JWT персонала (CEO/STAFF) — отдельной роли-киоска
// в MVP нет.
@Injectable()
export class LockersService {
  private readonly logger = new Logger(LockersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly gyms: GymsService,
    private readonly driver: LockerControllerDriver,
  ) {}

  findAll(gymId: string) {
    return this.prisma.locker.findMany({ where: { gymId }, orderBy: { number: 'asc' } });
  }

  // Освобождение вручную администратором (0.4.0) — работает в любом
  // режиме точки: разблокировать застрявшую аренду должен уметь персонал.
  async release(actor: JwtPayload, lockerId: string) {
    const locker = await this.prisma.locker.findFirst({ where: { id: lockerId, gymId: actor.gymId } });
    if (!locker) throw new NotFoundException('Шкафчик не найден');
    return this.prisma.locker.update({ where: { id: lockerId }, data: { status: 'FREE', rentedBy: null, rentedUntil: null, assignedAt: null } });
  }

  private async assertKioskMode(gymId: string) {
    const gym = await this.prisma.gym.findUnique({ where: { id: gymId }, select: { lockerMode: true } });
    if (gym?.lockerMode !== 'centralized_kiosk') {
      throw new BadRequestException('Точка работает в ручном режиме управления шкафчиками — аренду оформляет администратор на кассе');
    }
  }

  // Клиент ищется по всей сети (как на входе P2.2): шкафчик может выдавать
  // точка, отличная от домашней клиента.
  private async resolveClientByCode(actor: JwtPayload, code: string) {
    const raw = code.trim();
    if (!raw.startsWith(CHECKIN_CODE_PREFIX)) {
      throw new BadRequestException('Это не код прохода клуба — отсканируйте QR из приложения клиента («Мой QR»)');
    }
    const clientId = raw.slice(CHECKIN_CODE_PREFIX.length).trim();
    if (!clientId) throw new BadRequestException('Код прохода пустой');
    const networkId = await this.gyms.resolveNetworkId(actor);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, gym: { networkId } },
      select: { id: true, name: true },
    });
    if (!client) throw new NotFoundException('Клиент с таким кодом не найден в сети клуба');
    return client;
  }

  private equipped(locker: Locker): boolean {
    return !!locker.controllerId && locker.channelNumber != null;
  }

  private async openDoor(locker: Locker): Promise<void> {
    const ok = await this.driver.open(locker.controllerId!, locker.channelNumber!);
    if (!ok) {
      throw new BadRequestException(`Контроллер не ответил на команду открытия шкафчика №${locker.number} — обратитесь к администратору (шкафчик не занят)`);
    }
  }

  // Скан QR на терминале: назначить шкафчик или вернуть закреплённый.
  async kioskScan(actor: JwtPayload, code: string) {
    await this.assertKioskMode(actor.gymId);
    const client = await this.resolveClientByCode(actor, code);

    // Идемпотентность (P2.8): активная аренда клиента — по всей сети,
    // возвращаем её номер повторно, новый шкафчик не назначается.
    const active = await this.prisma.locker.findFirst({ where: { rentedBy: client.id, status: 'RENTED' } });
    if (active) {
      if (this.equipped(active)) {
        await this.openDoor(active);
        await this.prisma.locker.update({ where: { id: active.id }, data: { doorState: 'OPEN' } });
      }
      await this.activityLog.log(actor, 'Киоск: повторный скан — открыт шкафчик клиента', client.name, `шкафчик №${active.number}`);
      return { repeat: true, lockerNumber: active.number, clientName: client.name };
    }

    // Назначение свободного оснащённого шкафчика. Сначала блокируем строку
    // клиента (P3.10): два терминала, сканирующие один QR одновременно,
    // выстраиваются в очередь — второй после коммита первого увидит его
    // аренду и вернёт тот же шкафчик, а не второй параллельно. Выбор
    // шкафчика — FOR UPDATE SKIP LOCKED: параллельные назначения разных
    // клиентов не ждут друг друга и перескакивают на следующий свободный.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM clients WHERE id = ${client.id} FOR UPDATE`;
      const raced = await tx.locker.findFirst({ where: { rentedBy: client.id, status: 'RENTED' } });
      if (raced) {
        if (this.equipped(raced)) await this.openDoor(raced);
        await this.activityLog.log(actor, 'Киоск: повторный скан — открыт шкафчик клиента', client.name, `шкафчик №${raced.number}`);
        return { repeat: true, lockerNumber: raced.number, clientName: client.name };
      }
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM lockers
        WHERE gym_id = ${actor.gymId} AND status = 'FREE'
          AND controller_id IS NOT NULL AND channel_number IS NOT NULL
        ORDER BY number ASC LIMIT 1
        FOR UPDATE SKIP LOCKED`;
      if (rows.length === 0) {
        throw new BadRequestException('Нет свободных шкафчиков на точке — обратитесь к администратору');
      }
      const locker = await tx.locker.findUniqueOrThrow({ where: { id: rows[0].id } });
      await this.openDoor(locker);
      const updated = await tx.locker.update({
        where: { id: locker.id },
        data: { status: 'RENTED', rentedBy: client.id, rentedUntil: null, assignedAt: new Date(), doorState: 'OPEN' },
      });
      await this.activityLog.log(actor, 'Киоск назначил шкафчик', client.name, `шкафчик №${updated.number} (${updated.bankId ?? '—'}, контроллер ${updated.controllerId}, канал ${updated.channelNumber})`);
      return { repeat: false, lockerNumber: updated.number, clientName: client.name };
    });
  }

  // Выдача вещей: скан открывает дверцу. Аренда закрывается датчиком —
  // по колбэку CLOSED (ниже); без датчика шкафчик освобождается сразу.
  async kioskRelease(actor: JwtPayload, code: string) {
    await this.assertKioskMode(actor.gymId);
    const client = await this.resolveClientByCode(actor, code);
    const locker = await this.prisma.locker.findFirst({ where: { rentedBy: client.id, status: 'RENTED', gymId: actor.gymId } });
    if (!locker) throw new BadRequestException('За клиентом нет активного шкафчика на этой точке');

    if (this.equipped(locker)) {
      await this.openDoor(locker);
      await this.prisma.locker.update({ where: { id: locker.id }, data: { doorState: 'OPEN' } });
      await this.activityLog.log(actor, 'Киоск открыл шкафчик для выдачи вещей', client.name, `шкафчик №${locker.number} — освободится по закрытию дверцы`);
      return { releasedNow: false, lockerNumber: locker.number, clientName: client.name };
    }

    await this.prisma.locker.update({ where: { id: locker.id }, data: { status: 'FREE', rentedBy: null, rentedUntil: null, assignedAt: null } });
    await this.activityLog.log(actor, 'Киоск освободил шкафчик (без датчика двери)', client.name, `шкафчик №${locker.number}`);
    return { releasedNow: true, lockerNumber: locker.number, clientName: client.name };
  }

  // Колбэк контроллера о состоянии дверцы. CLOSED на арендованном
  // шкафчике завершает аренду (клиент забрал вещи и захлопнул дверцу);
  // OPEN на свободном — предупреждение в лог (дверца не закрыта; сквозной
  // алерт администратору — канал P3.7, которого ещё нет).
  async doorState(actor: JwtPayload, controllerId: string, channel: number, state: 'OPEN' | 'CLOSED') {
    const locker = await this.prisma.locker.findFirst({ where: { controllerId, channelNumber: channel, gymId: actor.gymId } });
    if (!locker) throw new NotFoundException('Шкафчик с таким контроллером/каналом не найден на этой точке');

    if (state === 'OPEN' && locker.status === 'FREE') {
      this.logger.warn(`Дверца свободного шкафчика №${locker.number} открыта — возможно, её не закрыли`);
    }

    const updated = await this.prisma.locker.update({ where: { id: locker.id }, data: { doorState: state } });
    if (state === 'CLOSED' && locker.status === 'RENTED') {
      await this.prisma.locker.update({ where: { id: locker.id }, data: { status: 'FREE', rentedBy: null, rentedUntil: null, assignedAt: null } });
      await this.activityLog.log(actor, 'Дверца шкафчика закрыта — аренда завершена', `шкафчик №${locker.number}`, `контроллер ${controllerId}, канал ${channel}`);
      return { ...updated, status: 'FREE' as const };
    }
    return updated;
  }
}
