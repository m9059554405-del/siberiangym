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

  // Запись на групповое занятие — с P0.2 идёт через POST /orders
  // (GROUP_CLASS_BOOKING) и применяется только после подтверждения оплаты
  // чеком, см. api/src/orders/orders.service.ts.

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

  // Запись на персональный слот — с P0.2 идёт через POST /orders
  // (PERSONAL_SLOT_BOOKING) и применяется только после подтверждения оплаты
  // чеком, см. api/src/orders/orders.service.ts.

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
