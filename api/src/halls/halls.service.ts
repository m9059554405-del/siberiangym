import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { GymsService } from '../gyms/gyms.service';
import type { JwtPayload } from '../auth/auth.service';
import type { CreateHallDto, UpdateHallDto } from './dto/hall.dto';

const hallInclude = {
  trainers: { include: { trainer: { select: { id: true, name: true, specialization: true, avatarHue: true } } } },
  prices: { orderBy: { amount: 'asc' as const } },
} satisfies Prisma.HallInclude;

// Залы внутри точки сети (заявка клуба): CEO создаёт тренажёрный зал,
// зал единоборств, тенниса и любой другой, привязывает тренеров и
// настраивает цены. Точка без зала существовать не может — удаление
// последнего зала точки запрещено.
@Injectable()
export class HallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gyms: GymsService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async list(actor: JwtPayload, gymId: string) {
    await this.gyms.assertBelongsToOwnedNetwork(actor, gymId);
    return this.prisma.hall.findMany({ where: { gymId }, include: hallInclude, orderBy: { createdAt: 'asc' } });
  }

  async create(actor: JwtPayload, dto: CreateHallDto) {
    await this.gyms.assertBelongsToOwnedNetwork(actor, dto.gymId);
    await this.assertTrainersInGym(dto.gymId, dto.trainerIds ?? []);
    const hall = await this.prisma.hall.create({
      data: {
        gymId: dto.gymId,
        name: dto.name.trim(),
        kind: dto.kind.trim(),
        ...(dto.trainerIds ? { trainers: { create: uniqueIds(dto.trainerIds).map((trainerId) => ({ trainerId })) } } : {}),
        ...(dto.prices ? { prices: { create: dto.prices.map((p) => ({ label: p.label.trim(), amount: p.amount })) } } : {}),
      },
      include: hallInclude,
    });
    await this.activityLog.log(actor, 'Создал зал в точке сети', hall.name, `${hall.kind} · id точки: ${hall.gymId}`);
    return hall;
  }

  async update(actor: JwtPayload, hallId: string, dto: UpdateHallDto) {
    const hall = await this.findOwned(actor, hallId);
    if (dto.name === undefined && dto.kind === undefined && dto.trainerIds === undefined && dto.prices === undefined) {
      throw new BadRequestException('Нечего обновлять');
    }
    if (dto.trainerIds) await this.assertTrainersInGym(hall.gymId, dto.trainerIds);
    const updated = await this.prisma.hall.update({
      where: { id: hallId },
      data: {
        name: dto.name?.trim(),
        kind: dto.kind?.trim(),
        ...(dto.trainerIds !== undefined
          ? {
              trainers: {
                deleteMany: {},
                create: uniqueIds(dto.trainerIds).map((trainerId) => ({ trainerId })),
              },
            }
          : {}),
        ...(dto.prices !== undefined
          ? {
              prices: {
                deleteMany: {},
                create: dto.prices.map((p) => ({ label: p.label.trim(), amount: p.amount })),
              },
            }
          : {}),
      },
      include: hallInclude,
    });
    await this.activityLog.log(actor, 'Изменил зал точки сети', updated.name, `${updated.kind} · id: ${hallId}`);
    return updated;
  }

  async remove(actor: JwtPayload, hallId: string) {
    const hall = await this.findOwned(actor, hallId);
    const hallsLeft = await this.prisma.hall.count({ where: { gymId: hall.gymId } });
    if (hallsLeft <= 1) {
      throw new ConflictException('Нельзя удалить последний зал точки — точка не существует без зала');
    }
    await this.prisma.hall.delete({ where: { id: hallId } });
    await this.activityLog.log(actor, 'Удалил зал точки сети', hall.name, `${hall.kind} · id точки: ${hall.gymId}`);
    return { ok: true };
  }

  private async findOwned(actor: JwtPayload, hallId: string) {
    const hall = await this.prisma.hall.findUnique({ where: { id: hallId } });
    if (!hall) throw new NotFoundException('Зал не найден');
    await this.gyms.assertBelongsToOwnedNetwork(actor, hall.gymId);
    return hall;
  }

  // Привязывать можно только тренеров, работающих на этой точке (домашняя
  // или дополнительная, P1.3) — зал внутри точки не может ссылаться на
  // тренера с другой точки, куда клиент этой точки попасть не может.
  private async assertTrainersInGym(gymId: string, trainerIds: string[]) {
    if (trainerIds.length === 0) return;
    const unique = uniqueIds(trainerIds);
    const trainers = await this.prisma.trainer.findMany({
      where: { id: { in: unique } },
      select: { id: true, name: true, gymId: true, additionalGyms: { select: { gymId: true } } },
    });
    if (trainers.length !== unique.length) {
      throw new NotFoundException('Среди выбранных тренеров есть несуществующие');
    }
    const outsiders = trainers.filter((t) => t.gymId !== gymId && !t.additionalGyms.some((g) => g.gymId === gymId));
    if (outsiders.length > 0) {
      throw new BadRequestException(
        `Тренеры не работают на этой точке: ${outsiders.map((t) => t.name).join(', ')} — сначала назначьте их на точку`,
      );
    }
  }
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}
