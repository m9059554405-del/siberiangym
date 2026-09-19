import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateCleaningZoneDto, UpdateCleaningZoneDto } from './dto/cleaning-zone.dto';
import type { JwtPayload } from '../auth/auth.service';

// Клининг точки (P4.2): набор зон настраивается владельцем под конкретный
// зал (раньше — глобальный enum из 7 значений демо-версии). Чек-лист при
// создании фиксирует текущий набор зон точкой; история ссылается на зоны
// через FK Restrict — зона с историей не удаляется, только переименовывается.

@Injectable()
export class CleaningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  findAll(gymId: string) {
    return this.prisma.cleaningChecklist.findMany({
      where: { gymId },
      include: { items: { include: { zone: true } } },
      orderBy: { date: 'desc' },
    });
  }

  listZones(gymId: string) {
    return this.prisma.cleaningZone.findMany({ where: { gymId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
  }

  async createZone(actor: JwtPayload, dto: CreateCleaningZoneDto) {
    const last = await this.prisma.cleaningZone.findFirst({ where: { gymId: actor.gymId }, orderBy: { position: 'desc' } });
    try {
      return await this.prisma.cleaningZone.create({
        data: { gymId: actor.gymId, name: dto.name, position: (last?.position ?? -1) + 1 },
      });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new ConflictException('Зона с таким названием уже есть');
      throw err;
    }
  }

  async updateZone(actor: JwtPayload, zoneId: string, dto: UpdateCleaningZoneDto) {
    const zone = await this.prisma.cleaningZone.findFirst({ where: { id: zoneId, gymId: actor.gymId } });
    if (!zone) throw new NotFoundException('Зона не найдена');
    if (dto.name === undefined && dto.position === undefined) throw new BadRequestException('Нечего обновлять');
    try {
      return await this.prisma.cleaningZone.update({ where: { id: zoneId }, data: { name: dto.name, position: dto.position } });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw new ConflictException('Зона с таким названием уже есть');
      throw err;
    }
  }

  async removeZone(actor: JwtPayload, zoneId: string) {
    const zone = await this.prisma.cleaningZone.findFirst({ where: { id: zoneId, gymId: actor.gymId } });
    if (!zone) throw new NotFoundException('Зона не найдена');
    const used = await this.prisma.cleaningChecklistItem.count({ where: { zoneId } });
    if (used > 0) {
      throw new ConflictException('Зона уже используется в истории чек-листов — удаление сломало бы её; можно переименовать зону вместо удаления');
    }
    await this.prisma.cleaningZone.delete({ where: { id: zoneId } });
    await this.activityLog.log(actor, 'Удалил зону уборки', zone.name, '');
    return { ok: true };
  }

  async create(actor: JwtPayload, dto: CreateChecklistDto) {
    const zones = await this.prisma.cleaningZone.findMany({ where: { gymId: actor.gymId }, orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    if (zones.length === 0) {
      throw new BadRequestException('У точки не настроено ни одной зоны уборки — сначала задайте список зон');
    }
    return this.prisma.cleaningChecklist.create({
      data: {
        gymId: actor.gymId,
        date: new Date(dto.date),
        responsibleName: dto.responsibleName,
        items: { create: zones.map((zone) => ({ zoneId: zone.id, done: false })) },
      },
      include: { items: { include: { zone: true } } },
    });
  }

  async toggleItem(actor: JwtPayload, checklistId: string, zoneId: string) {
    const checklist = await this.prisma.cleaningChecklist.findFirst({ where: { id: checklistId, gymId: actor.gymId } });
    if (!checklist) throw new NotFoundException('Чек-лист не найден');
    const item = await this.prisma.cleaningChecklistItem.findUnique({
      where: { checklistId_zoneId: { checklistId, zoneId } },
      include: { zone: true },
    });
    if (!item) throw new NotFoundException('Пункт не найден');

    const updated = await this.prisma.cleaningChecklistItem.update({
      where: { id: item.id },
      data: { done: !item.done },
    });

    await this.activityLog.log(
      actor,
      updated.done ? 'Отметил уборку выполненной' : 'Снял отметку уборки',
      checklist.date.toISOString().slice(0, 10),
      item.zone.name,
    );
    return updated;
  }
}
