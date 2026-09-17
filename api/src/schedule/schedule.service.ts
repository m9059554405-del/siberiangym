import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { EmailService } from '../email/email.service';
import { CreateGroupClassDto } from './dto/create-group-class.dto';
import { CreatePersonalSlotDto } from './dto/create-personal-slot.dto';
import type { JwtPayload } from '../auth/auth.service';
import { SlotStatus } from '@prisma/client';
import { TrainersService } from '../trainers/trainers.service';
import { GymsService } from '../gyms/gyms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { startOfDay } from '../clients/membership.const';

// Резолвит clientId для self-service действий: клиент может действовать
// только от своего имени, CEO/STAFF должны явно передать clientId.
async function resolveClientId(prisma: PrismaService, actor: JwtPayload, explicit?: string): Promise<string> {
  if (actor.role === 'CLIENT') {
    const client = await prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return client.id;
  }
  if (!explicit) throw new BadRequestException('Не указан clientId');
  return explicit;
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly trainers: TrainersService,
    private readonly gyms: GymsService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  // Тренер на нескольких точках сети (P1.3) должен видеть свой календарь
  // целиком, без переключения точки; CEO с P1.7 видит расписание сети
  // целиком (основа отчётов «посещаемость» и «занятость тренеров» без
  // раздельного захода в каждую точку). Клиенту и STAFF список остаётся
  // строго про их текущую точку по токену, как и раньше.
  private async gymIdsForActor(actor: JwtPayload): Promise<string[]> {
    if (actor.role === 'CEO') return this.gyms.resolveNetworkGymIds(actor);
    if (actor.role !== 'TRAINER') return [actor.gymId];
    const trainer = await this.prisma.trainer.findUnique({ where: { userId: actor.sub }, include: { additionalGyms: true } });
    if (!trainer) return [actor.gymId];
    return [trainer.gymId, ...trainer.additionalGyms.map((g) => g.gymId)];
  }

  // --- Групповые занятия ---

  async listGroupClasses(actor: JwtPayload) {
    const gymIds = await this.gymIdsForActor(actor);
    return this.prisma.groupClass.findMany({
      where: { gymId: { in: gymIds } },
      include: { trainer: true, bookings: true, waitlist: true },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
  }

  async createGroupClass(actor: JwtPayload, dto: CreateGroupClassDto) {
    const trainer = await this.trainers.assertTrainerAtGym(dto.trainerId, actor.gymId);
    const gc = await this.prisma.groupClass.create({
      data: { gymId: actor.gymId, ...dto, date: new Date(dto.date) },
    });
    await this.activityLog.log(actor, 'Создал групповое занятие', dto.type, `${dto.date} ${dto.start}–${dto.end}, тренер: ${trainer.name}`);
    return gc;
  }

  // Запись на групповое занятие — с P0.2 идёт через POST /orders
  // (GROUP_CLASS_BOOKING) и применяется только после подтверждения оплаты
  // чеком, см. api/src/orders/orders.service.ts.

  async cancelGroupClassBooking(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const deleted = await this.prisma.groupClassBooking.deleteMany({ where: { groupClassId: classId, clientId } });
    if (deleted.count > 0) {
      // Место освободилось — первый в листе ожидания получает уведомление
      // (P2.3). Промоут после удаления, а не в транзакции с ним: письмо не
      // должно отправиться, если сама отмена по какой-то причине откатится.
      await this.promoteWaitlist(classId);
    }
    await this.activityLog.log(actor, 'Отменил запись на групповое занятие', clientId, classId);
    return { ok: true };
  }

  // --- Лист ожидания на групповое занятие (P2.3) ---

  async joinWaitlist(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const gymIds = await this.gymIdsForActor(actor);
    const gc = await this.prisma.groupClass.findFirst({
      where: { id: classId, gymId: { in: gymIds } },
      include: { bookings: true, waitlist: true },
    });
    if (!gc) throw new NotFoundException('Занятие не найдено');
    if (gc.date.getTime() < startOfDay(new Date()).getTime()) {
      throw new BadRequestException('Занятие уже прошло — лист ожидания не имеет смысла');
    }
    if (gc.bookings.some((b) => b.clientId === clientId)) {
      throw new BadRequestException('Клиент уже записан на это занятие — лист ожидания не нужен');
    }
    if (gc.bookings.length < gc.capacity) {
      throw new BadRequestException('На занятии есть свободные места — запишитесь обычным способом (через оплату заказа)');
    }
    try {
      const entry = await this.prisma.groupClassWaitlistEntry.create({ data: { groupClassId: gc.id, clientId } });
      const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } });
      await this.activityLog.log(actor, 'Записал в лист ожидания', client.name, `${gc.type}, ${gc.date.toISOString().slice(0, 10)} ${gc.start} (позиция ${gc.waitlist.length + 1})`);
      return entry;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Клиент уже в листе ожидания на это занятие');
      }
      throw err;
    }
  }

  async leaveWaitlist(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const deleted = await this.prisma.groupClassWaitlistEntry.deleteMany({ where: { groupClassId: classId, clientId } });
    if (deleted.count === 0) throw new NotFoundException('Запись в листе ожидания не найдена');
    return { ok: true };
  }

  // Место освободилось (отмена записи или возврат по заказу) — уведомляем
  // первого ещё не уведомлённого ждущего. Место НЕ резервируется: запись
  // остаётся обычной покупкой через заказ с чеком (P0.2), уведомление
  // только сообщает, что очередь подошла. Ждущие, которые успели
  // записаться сами (гонка места и очереди), из очереди выбывают молча.
  // Уведомление одно на освобождение — очередь двигается дальше только
  // при следующем освобождении; отказавшиеся выбывают через leaveWaitlist.
  async promoteWaitlist(classId: string) {
    const gc = await this.prisma.groupClass.findUnique({
      where: { id: classId },
      include: {
        bookings: true,
        waitlist: { orderBy: { joinedAt: 'asc' }, include: { client: { select: { name: true, email: true } } } },
      },
    });
    if (!gc || gc.bookings.length >= gc.capacity) return;

    const bookedIds = new Set(gc.bookings.map((b) => b.clientId));
    const stale = gc.waitlist.filter((w) => bookedIds.has(w.clientId));
    if (stale.length > 0) {
      await this.prisma.groupClassWaitlistEntry.deleteMany({ where: { id: { in: stale.map((w) => w.id) } } });
    }
    const next = gc.waitlist.find((w) => !bookedIds.has(w.clientId) && !w.notifiedAt);
    if (!next) return;

    await this.prisma.groupClassWaitlistEntry.update({ where: { id: next.id }, data: { notifiedAt: new Date() } });
    await this.email.send(
      next.client.email,
      'Место освободилось — занятие SiberianGym',
      `Здравствуйте, ${next.client.name}!\n\nМесто освободилось на занятии «${gc.type}» ${gc.date.toISOString().slice(0, 10)} в ${gc.start}.\nМесто не резервируется: запишитесь обычным способом в приложении (Календарь → Записаться). Если вас опередят — вы останетесь в очереди и получите следующее уведомление после отказа.\n\nSiberianGym`,
    );
  }

  // --- Персональные слоты ---

  async listPersonalSlots(actor: JwtPayload) {
    const gymIds = await this.gymIdsForActor(actor);
    return this.prisma.personalSlot.findMany({
      where: { gymId: { in: gymIds } },
      include: { trainer: true, client: true },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
  }

  async createPersonalSlot(actor: JwtPayload, dto: CreatePersonalSlotDto) {
    await this.trainers.assertTrainerAtGym(dto.trainerId, actor.gymId);
    return this.prisma.personalSlot.create({
      data: { gymId: actor.gymId, trainerId: dto.trainerId, date: new Date(dto.date), start: dto.start, end: dto.end, status: 'FREE' },
    });
  }

  // Запись на персональный слот — с P0.2 идёт через POST /orders
  // (PERSONAL_SLOT_BOOKING) и применяется только после подтверждения оплаты
  // чеком, см. api/src/orders/orders.service.ts.

  async cancelPersonalSlot(actor: JwtPayload, slotId: string) {
    const slot = await this.prisma.personalSlot.findFirst({ where: { id: slotId, gymId: actor.gymId }, include: { trainer: true } });
    if (!slot) throw new NotFoundException('Слот не найден');
    if (actor.role === 'CLIENT') {
      const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
      if (!client || slot.clientId !== client.id) throw new ForbiddenException('Это не ваша запись');
    }
    await this.prisma.personalSlot.update({ where: { id: slotId }, data: { status: 'FREE', clientId: null } });
    // Отмена забронированного слота — «критичное» напоминание из P2.4:
    // клиент мог уже планировать день вокруг тренировки, поэтому канал
    // SMS подключается как fallback (в демо логируется). Отмену самим
    // клиентом тоже шлём — подтверждение не помешает.
    if (slot.clientId && slot.status === 'BOOKED') {
      await this.notifications.notify(
        slot.clientId,
        'SLOT_CANCELLED',
        'Персональная тренировка отменена',
        `Слот ${slot.date.toISOString().slice(0, 10)} ${slot.start} у тренера ${slot.trainer.name} освобождён. Запишитесь на другое время.`,
        slot.id,
      );
    }
    return this.prisma.personalSlot.findUniqueOrThrow({ where: { id: slotId } });
  }

  // Тренер/администратор отмечает явку после тренировки.
  async markSlotAttendance(actor: JwtPayload, slotId: string, status: Extract<SlotStatus, 'PAST_COMPLETED' | 'PAST_MISSED'>) {
    const slot = await this.prisma.personalSlot.findFirst({ where: { id: slotId, gymId: actor.gymId } });
    if (!slot) throw new NotFoundException('Слот не найден');
    const updated = await this.prisma.personalSlot.update({ where: { id: slotId }, data: { status } });
    await this.activityLog.log(actor, 'Отметил явку на тренировку', slotId, status === 'PAST_COMPLETED' ? 'Пришёл' : 'Не пришёл');
    return updated;
  }
}
