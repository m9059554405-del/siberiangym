import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateGymDto, UpdateGymDto } from './dto/gym.dto';
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

  // Без проверки владения — просто "в какой сети моя текущая точка".
  // Безопасно для любой роли (STAFF/CEO/TRAINER): не раскрывает ничего,
  // кроме внутреннего id сети, к которой и так принадлежит их собственный
  // gymId. Используется для чтения через всю сеть (P1.5 — межточечный
  // поиск клиента), а не для управления сетью (для этого — только
  // владелец, см. resolveOwnedNetworkId ниже).
  async resolveNetworkId(actor: JwtPayload): Promise<string> {
    const gym = await this.prisma.gym.findUniqueOrThrow({ where: { id: actor.gymId }, select: { networkId: true } });
    return gym.networkId;
  }

  async resolveOwnedNetworkId(actor: JwtPayload): Promise<string> {
    const gym = await this.prisma.gym.findUniqueOrThrow({ where: { id: actor.gymId }, select: { networkId: true } });
    const network = await this.prisma.network.findUnique({ where: { id: gym.networkId } });
    if (!network || network.ownerId !== actor.sub) {
      throw new ForbiddenException('Вы не являетесь владельцем сети, к которой принадлежит эта точка');
    }
    return network.id;
  }

  // Все точки сети, к которой относится текущая точка actor.gymId (P1.7) —
  // источник сетевого охвата для CEO-отчётов (выручка/посещаемость/
  // занятость тренеров). Роль проверяют вызывающие: сводка по сети —
  // только CEO, STAFF остаётся строго в рамках своей точки (P1.6).
  async resolveNetworkGymIds(actor: JwtPayload): Promise<string[]> {
    const networkId = await this.resolveNetworkId(actor);
    const gyms = await this.prisma.gym.findMany({ where: { networkId }, select: { id: true } });
    return gyms.map((g) => g.id);
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

  // Админские логины (STAFF, P1.10) по всей сети — для страницы управления
  // точками: у STAFF нет отдельной карточки-сущности, единственное место,
  // где видно «кто администратор и на какой точке» — это таблица User.
  async listStaff(actor: JwtPayload) {
    const networkId = await this.resolveOwnedNetworkId(actor);
    return this.prisma.user.findMany({
      where: { role: Role.STAFF, gym: { networkId } },
      select: { id: true, name: true, email: true, phone: true, gymId: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Перенос администратора на другую точку сети. Переносить можно только
  // STAFF: CEO принадлежит сети (Network.ownerId), а перенос CLIENT/TRAINER
  // ломал бы их бизнес-карточки, привязанные к домашней точке.
  async moveStaff(actor: JwtPayload, userId: string, targetGymId: string) {
    await this.assertBelongsToOwnedNetwork(actor, targetGymId);
    const networkId = await this.resolveOwnedNetworkId(actor);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { gym: { select: { networkId: true } } },
    });
    if (!user || user.gym.networkId !== networkId) {
      throw new NotFoundException('Администратор не найден в вашей сети');
    }
    if (user.role !== 'STAFF') throw new BadRequestException('Переносить между точками можно только администраторов');
    if (user.gymId === targetGymId) return user;
    const moved = await this.prisma.user.update({
      where: { id: userId },
      data: { gymId: targetGymId },
      select: { id: true, name: true, email: true, phone: true, gymId: true, role: true, isActive: true, createdAt: true },
    });
    await this.activityLog.log(actor, 'Перенёс администратора на точку сети', moved.name ?? moved.email ?? moved.id, `id точки: ${targetGymId}`);
    return moved;
  }

  async update(actor: JwtPayload, gymId: string, dto: UpdateGymDto) {
    await this.assertBelongsToOwnedNetwork(actor, gymId);
    if (dto.name === undefined && dto.selfTrainingMinAge === undefined) {
      throw new BadRequestException('Нечего обновлять');
    }
    const gym = await this.prisma.gym.update({
      where: { id: gymId },
      data: { name: dto.name, selfTrainingMinAge: dto.selfTrainingMinAge },
    });
    await this.activityLog.log(actor, 'Изменил точку сети', gym.name, `id: ${gym.id}`);
    return gym;
  }

  // Удаление точки сети (по заявке клуба) — только «пустая» точка: в схеме
  // у Gym ~25 связанных таблиц, и молчаливое каскадное удаление клиентов,
  // выручки и склада недопустимо. trainerGyms ссылаются с Cascade (P1.3),
  // pricing — без каскада, поэтому строка цен удаляется явно, внутри той
  // же транзакции.
  async remove(actor: JwtPayload, gymId: string) {
    await this.assertBelongsToOwnedNetwork(actor, gymId);
    if (gymId === actor.gymId) {
      throw new ConflictException('Сначала переключитесь на другую точку — нельзя удалить точку, в которой вы сейчас находитесь');
    }
    const networkId = await this.resolveOwnedNetworkId(actor);
    const gymsLeft = await this.prisma.gym.count({ where: { networkId } });
    if (gymsLeft <= 1) {
      throw new ConflictException('Нельзя удалить последнюю точку сети');
    }

    const gym = await this.prisma.gym.findUniqueOrThrow({
      where: { id: gymId },
      select: {
        name: true,
        _count: {
          select: {
            users: true, clients: true, trainers: true, exercises: true, groupClasses: true,
            personalSlots: true, lockers: true, catalogItems: true, transactions: true, clubPosts: true,
            stockBatches: true, stockWriteoffs: true, stockReceipts: true, inventoryCounts: true, equipment: true,
            cleaningChecklists: true, directorMessages: true, reportOffers: true, activityLogEntries: true,
            outreachNotes: true, orders: true, refunds: true, consentRecords: true, guardians: true,
          },
        },
      },
    });

    const labels: Record<string, string> = {
      users: 'пользователи', clients: 'клиенты', trainers: 'тренеры', exercises: 'упражнения',
      groupClasses: 'групповые занятия', personalSlots: 'персональные слоты', lockers: 'шкафчики',
      catalogItems: 'товары каталога', transactions: 'транзакции', clubPosts: 'посты клуба',
      stockBatches: 'партии склада', stockWriteoffs: 'списания', stockReceipts: 'приход склада',
      inventoryCounts: 'инвентаризации', equipment: 'оборудование', cleaningChecklists: 'чек-листы уборки',
      directorMessages: 'сообщения директору', reportOffers: 'предложения', activityLogEntries: 'журнал изменений',
      outreachNotes: 'заметки обзвона', orders: 'заказы', refunds: 'возвраты',
      consentRecords: 'согласия', guardians: 'родители',
    };
    const busy = Object.entries(gym._count)
      .filter(([, count]) => count > 0)
      .map(([key, count]) => `${labels[key] ?? key}: ${count}`);
    if (busy.length > 0) {
      throw new ConflictException(
        `Точка «${gym.name}» не пустая — сначала перенесите или удалите данные (${busy.join(', ')})`,
      );
    }

    await this.activityLog.log(actor, 'Удалил точку сети', gym.name, `id: ${gymId}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.membershipPricing.deleteMany({ where: { gymId } });
      await tx.trainerGym.deleteMany({ where: { gymId } });
      await tx.gym.delete({ where: { id: gymId } });
    });
    return { ok: true };
  }
}
