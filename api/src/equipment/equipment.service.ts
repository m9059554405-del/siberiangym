import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { CompleteServiceDto } from './dto/complete-service.dto';
import type { JwtPayload } from '../auth/auth.service';

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  findAll(gymId: string) {
    return this.prisma.equipment.findMany({ where: { gymId }, orderBy: { nextServiceDate: 'asc' } });
  }

  async create(actor: JwtPayload, dto: CreateEquipmentDto) {
    const lastServiceDate = new Date(dto.lastServiceDate);
    const equipment = await this.prisma.equipment.create({
      data: {
        gymId: actor.gymId,
        name: dto.name,
        category: dto.category,
        zone: dto.zone,
        responsibleName: dto.responsibleName,
        lastServiceDate,
        nextServiceDate: addDays(lastServiceDate, dto.intervalDays),
        intervalDays: dto.intervalDays,
        warrantyUntil: dto.warrantyUntil ? new Date(dto.warrantyUntil) : null,
      },
    });
    await this.activityLog.log(actor, 'Добавил оборудование', equipment.name, dto.zone);
    return equipment;
  }

  async completeService(actor: JwtPayload, id: string, dto: CompleteServiceDto) {
    const equipment = await this.prisma.equipment.findFirst({ where: { id, gymId: actor.gymId } });
    if (!equipment) throw new NotFoundException('Оборудование не найдено');

    const lastServiceDate = dto.serviceDate ? new Date(dto.serviceDate) : new Date();
    const nextServiceDate = addDays(lastServiceDate, equipment.intervalDays);

    const updated = await this.prisma.equipment.update({
      where: { id },
      data: { lastServiceDate, nextServiceDate, responsibleName: dto.responsibleName },
    });

    await this.activityLog.log(
      actor,
      'Отметил ППР выполненным',
      equipment.name,
      `Ответственный: ${dto.responsibleName}, след. ТО: ${nextServiceDate.toISOString().slice(0, 10)}`,
    );
    return updated;
  }
}
