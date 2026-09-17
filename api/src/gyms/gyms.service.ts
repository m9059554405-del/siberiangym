import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateGymDto } from './dto/gym.dto';
import type { JwtPayload } from '../auth/auth.service';

// Точки одной сети (P1.1) — CEO управляет несколькими Gym в рамках одной
// Network. `resolveOwnedNetworkId` — единая точка входа для авторизации:
// сеть определяется не по параметру из запроса, а по тому, в какой Gym
// сейчас реально скопирован токен CEO (не даёт подсунуть чужой networkId).
@Injectable()
export class GymsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async resolveOwnedNetworkId(actor: JwtPayload): Promise<string> {
    const gym = await this.prisma.gym.findUniqueOrThrow({ where: { id: actor.gymId }, select: { networkId: true } });
    const network = await this.prisma.network.findUnique({ where: { id: gym.networkId } });
    if (!network || network.ownerId !== actor.sub) {
      throw new ForbiddenException('Вы не являетесь владельцем сети, к которой принадлежит эта точка');
    }
    return network.id;
  }

  async listForNetwork(actor: JwtPayload) {
    const networkId = await this.resolveOwnedNetworkId(actor);
    return this.prisma.gym.findMany({ where: { networkId }, orderBy: { createdAt: 'asc' } });
  }

  async create(actor: JwtPayload, dto: CreateGymDto) {
    const networkId = await this.resolveOwnedNetworkId(actor);
    const gym = await this.prisma.gym.create({
      data: { networkId, name: dto.name, selfTrainingMinAge: dto.selfTrainingMinAge ?? 18 },
    });
    // Без этого свежая точка вообще не может продать абонемент — эндпоинт
    // цен (P1.2) требует существующую строку MembershipPricing, а её
    // прежде вообще неоткуда было взять, кроме seed-скрипта. Копируем
    // текущие цены (включая сетевые, если настроены) как разумный
    // стартовый набор — CEO может сразу поправить их через PATCH /pricing,
    // переключившись на новую точку.
    const sourcePricing = await this.prisma.membershipPricing.findUnique({ where: { gymId: actor.gymId } });
    if (sourcePricing) {
      const { id: _id, gymId: _gymId, ...priceFields } = sourcePricing;
      await this.prisma.membershipPricing.create({ data: { gymId: gym.id, ...priceFields } });
    }
    await this.activityLog.log(actor, 'Добавил точку в сеть', gym.name, `id: ${gym.id}`);
    return gym;
  }

  async assertBelongsToOwnedNetwork(actor: JwtPayload, gymId: string): Promise<void> {
    const networkId = await this.resolveOwnedNetworkId(actor);
    const target = await this.prisma.gym.findUnique({ where: { id: gymId } });
    if (!target || target.networkId !== networkId) {
      throw new NotFoundException('Точка не найдена в вашей сети');
    }
  }
}
