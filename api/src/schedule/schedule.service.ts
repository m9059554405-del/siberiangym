import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateGroupClassDto } from './dto/create-group-class.dto';
import { CreatePersonalSlotDto } from './dto/create-personal-slot.dto';
import type { JwtPayload } from '../auth/auth.service';
import { SlotStatus } from '@prisma/client';

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
  ) {}

  // --- Групповые занятия ---

  listGroupClasses(gymId: string) {
    return this.prisma.groupClass.findMany({
      where: { gymId },
      include: { trainer: true, bookings: true },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
  }

  async createGroupClass(actor: JwtPayload, dto: CreateGroupClassDto) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id: dto.trainerId, gymId: actor.gymId } });
    if (!trainer) throw new NotFoundException('Тренер не найден');
    const gc = await this.prisma.groupClass.create({
      data: { gymId: actor.gymId, ...dto, date: new Date(dto.date) },
    });
    await this.activityLog.log(actor, 'Создал групповое занятие', dto.type, `${dto.date} ${dto.start}–${dto.end}, тренер: ${trainer.name}`);
    return gc;
  }

  async bookGroupClass(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const gc = await this.prisma.groupClass.findFirst({ where: { id: classId, gymId: actor.gymId }, include: { bookings: true } });
    if (!gc) throw new NotFoundException('Занятие не найдено');
    if (gc.bookings.some((b) => b.clientId === clientId)) throw new BadRequestException('Клиент уже записан');
    if (gc.bookings.length >= gc.capacity) throw new BadRequestException('Мест не осталось');

    const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId: actor.gymId } });
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });

    await this.prisma.$transaction([
      this.prisma.groupClassBooking.create({ data: { groupClassId: classId, clientId } }),
      this.prisma.transaction.create({
        data: {
          gymId: actor.gymId,
          amount: pricing?.groupSingle ?? 0,
          category: 'GROUP',
          clientId,
          trainerId: gc.trainerId,
          description: `Запись на групповую тренировку — ${gc.type}`,
        },
      }),
    ]);

    await this.activityLog.log(actor, 'Записался на групповое занятие', client.name, `${gc.type}, ${gc.date.toISOString().slice(0, 10)}`);
    return this.prisma.groupClass.findUnique({ where: { id: classId }, include: { bookings: true } });
  }

  async cancelGroupClassBooking(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    await this.prisma.groupClassBooking.deleteMany({ where: { groupClassId: classId, clientId } });
    await this.activityLog.log(actor, 'Отменил запись на групповое занятие', clientId, classId);
    return { ok: true };
  }

  // --- Персональные слоты ---

  listPersonalSlots(gymId: string) {
    return this.prisma.personalSlot.findMany({
      where: { gymId },
      include: { trainer: true, client: true },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
  }

  async createPersonalSlot(actor: JwtPayload, dto: CreatePersonalSlotDto) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id: dto.trainerId, gymId: actor.gymId } });
    if (!trainer) throw new NotFoundException('Тренер не найден');
    return this.prisma.personalSlot.create({
      data: { gymId: actor.gymId, trainerId: dto.trainerId, date: new Date(dto.date), start: dto.start, end: dto.end, status: 'FREE' },
    });
  }

  async bookPersonalSlot(actor: JwtPayload, slotId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const slot = await this.prisma.personalSlot.findFirst({ where: { id: slotId, gymId: actor.gymId }, include: { trainer: true } });
    if (!slot) throw new NotFoundException('Слот не найден');
    if (slot.status !== 'FREE') throw new BadRequestException('Слот уже занят');
    const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });

    await this.prisma.$transaction([
      this.prisma.personalSlot.update({ where: { id: slotId }, data: { status: 'BOOKED', clientId } }),
      this.prisma.transaction.create({
        data: {
          gymId: actor.gymId,
          amount: slot.trainer.personalSessionPrice,
          category: 'PERSONAL',
          clientId,
          trainerId: slot.trainerId,
          description: `Персональная тренировка — ${slot.trainer.name}`,
        },
      }),
    ]);

    await this.activityLog.log(actor, 'Записался на персональную тренировку', client.name, `${slot.trainer.name}, ${slot.date.toISOString().slice(0, 10)} ${slot.start}`);
    return this.prisma.personalSlot.findUnique({ where: { id: slotId } });
  }

  async cancelPersonalSlot(actor: JwtPayload, slotId: string) {
    const slot = await this.prisma.personalSlot.findFirst({ where: { id: slotId, gymId: actor.gymId } });
    if (!slot) throw new NotFoundException('Слот не найден');
    if (actor.role === 'CLIENT') {
      const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
      if (!client || slot.clientId !== client.id) throw new ForbiddenException('Это не ваша запись');
    }
    return this.prisma.personalSlot.update({ where: { id: slotId }, data: { status: 'FREE', clientId: null } });
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
