import { Injectable, NotFoundException } from '@nestjs/common';
import { CleaningArea } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import type { JwtPayload } from '../auth/auth.service';

const ALL_AREAS: CleaningArea[] = ['FLOOR', 'LIGHTING', 'SURFACES', 'MIRRORS', 'RESTROOMS', 'LOCKERS', 'WINDOWS'];
const AREA_LABEL: Record<CleaningArea, string> = {
  FLOOR: 'Пол', LIGHTING: 'Освещение', SURFACES: 'Поверхности', MIRRORS: 'Зеркала',
  RESTROOMS: 'Санузлы', LOCKERS: 'Шкафчики', WINDOWS: 'Окна',
};

@Injectable()
export class CleaningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  findAll(gymId: string) {
    return this.prisma.cleaningChecklist.findMany({
      where: { gymId },
      include: { items: true },
      orderBy: { date: 'desc' },
    });
  }

  async create(actor: JwtPayload, dto: CreateChecklistDto) {
    return this.prisma.cleaningChecklist.create({
      data: {
        gymId: actor.gymId,
        date: new Date(dto.date),
        responsibleName: dto.responsibleName,
        items: { create: ALL_AREAS.map((area) => ({ area, done: false })) },
      },
      include: { items: true },
    });
  }

  async toggleItem(actor: JwtPayload, checklistId: string, area: CleaningArea) {
    const checklist = await this.prisma.cleaningChecklist.findFirst({ where: { id: checklistId, gymId: actor.gymId } });
    if (!checklist) throw new NotFoundException('Чек-лист не найден');
    const item = await this.prisma.cleaningChecklistItem.findUnique({ where: { checklistId_area: { checklistId, area } } });
    if (!item) throw new NotFoundException('Пункт не найден');

    const updated = await this.prisma.cleaningChecklistItem.update({
      where: { id: item.id },
      data: { done: !item.done },
    });

    await this.activityLog.log(
      actor,
      updated.done ? 'Отметил уборку выполненной' : 'Снял отметку уборки',
      checklist.date.toISOString().slice(0, 10),
      AREA_LABEL[area],
    );
    return updated;
  }
}
