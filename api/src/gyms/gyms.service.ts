import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateGymDto, ReplaceWorkingHoursDto, UpdateGymDto } from './dto/gym.dto';
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
    // Без этого свежая точка вообще не может продать абонемент — эндпоинт
    // цен (P1.2) требует существующую строку MembershipPricing, а её
    // прежде вообще неоткуда было взять, кроме seed-скрипта. Копируем
    // текущие цены (включая сетевые, если настроены) как разумный
    // стартовый набор — CEO может сразу поправить их через PATCH /pricing,
    // переключившись на новую точку.
    const sourcePricing = await this.prisma.membershipPricing.findUnique({ where: { gymId: actor.gymId } });
    // Стартовый набор зон уборки и часов работы тоже копируется из текущей
    // точки (P4.2): новая точка сети начинается с проверенного набора,
    // а не с пустоты — как и цены выше.
    const [sourceZones, sourceHours] = await Promise.all([
      this.prisma.cleaningZone.findMany({ where: { gymId: actor.gymId }, orderBy: { position: 'asc' } }),
      this.prisma.gymWorkingHours.findMany({ where: { gymId: actor.gymId } }),
    ]);
    const gym = await this.prisma.$transaction(async (tx) => {
      const created = await tx.gym.create({
        data: { networkId, name: dto.name, selfTrainingMinAge: dto.selfTrainingMinAge ?? 18 },
      });
      // Точка без зала существовать не может (заявка клуба) — каждая
      // новая точка стартует с дефолтным тренажёрным залом; CEO потом
      // добавляет залы единоборств/тенниса и любые другие в UI точек.
      await tx.hall.create({
        data: { gymId: created.id, name: 'Тренажерный зал', kind: 'Тренажерный зал' },
      });
      if (sourcePricing) {
        const { id: _id, gymId: _gymId, ...priceFields } = sourcePricing;
        await tx.membershipPricing.create({ data: { gymId: created.id, ...priceFields } });
      }
      if (sourceZones.length > 0) {
        await tx.cleaningZone.createMany({
          data: sourceZones.map((z) => ({ gymId: created.id, name: z.name, position: z.position })),
        });
      }
      if (sourceHours.length > 0) {
        await tx.gymWorkingHours.createMany({
          data: sourceHours.map((h) => ({ gymId: created.id, weekday: h.weekday, open: h.open, close: h.close })),
        });
      }
      return created;
    });
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

  // Деактивация/реактивация логина администратора (P3.9): не удаляем User —
  // на него ссылается история (activity-log, заказы, авторство). Отключённый
  // логин не может войти (login проверяет isActive), а активные JWT умирают
  // сразу через подъём sessionVersion (P3.8).
  async setStaffActive(actor: JwtPayload, userId: string, isActive: boolean) {
    const networkId = await this.resolveOwnedNetworkId(actor);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { gym: { select: { networkId: true } } },
    });
    if (!user || user.gym.networkId !== networkId) {
      throw new NotFoundException('Администратор не найден в вашей сети');
    }
    if (user.role !== 'STAFF') throw new BadRequestException('Деактивировать можно только администраторов');
    if (user.isActive === isActive) return user;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isActive,
        // Деактивация отзывает выданные токены сразу; реактивация ничего
        // не отзывает, но требовать новую версию безвредно и единообразно.
        sessionVersion: { increment: 1 },
      },
      select: { id: true, name: true, email: true, phone: true, gymId: true, role: true, isActive: true, createdAt: true },
    });
    await this.activityLog.log(actor, isActive ? 'Включил логин администратора' : 'Деактивировал логин администратора', updated.name ?? updated.email ?? updated.id, 'История действий сохранена, запись User не удаляется');
    return updated;
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
      // Часы работы каскадятся по FK; зоны — RESTRICT (история чек-листов
      // ссылается), но сюда точка доходит только без единого чек-листа,
      // поэтому набор зон-конфига можно удалить вместе с точкой.
      await tx.cleaningZone.deleteMany({ where: { gymId } });
      await tx.gymWorkingHours.deleteMany({ where: { gymId } });
      await tx.trainerGym.deleteMany({ where: { gymId } });
      // Залы — тоже конфиг точки (каскад удаляет цены и привязки тренеров).
      await tx.hall.deleteMany({ where: { gymId } });
      await tx.gym.delete({ where: { id: gymId } });
    });
    return { ok: true };
  }

  // --- Часы работы точки (P4.2) ---

  listWorkingHours(gymId: string) {
    return this.prisma.gymWorkingHours.findMany({ where: { gymId }, orderBy: { weekday: 'asc' } });
  }

  // PUT заменяет весь набор: дни не в списке — «без ограничений», пустой
  // список снимает ограничения целиком. Расписание точки остаётся живым
  // (существующие занятия не трогаем) — часы влияют только на создание
  // новых занятий/слотов и генерацию серий.
  async replaceWorkingHours(actor: JwtPayload, dto: ReplaceWorkingHoursDto) {
    const seen = new Set<number>();
    for (const item of dto.items) {
      if (seen.has(item.weekday)) {
        throw new BadRequestException(`День недели ${item.weekday} указан больше одного раза`);
      }
      seen.add(item.weekday);
      if (item.open >= item.close) {
        throw new BadRequestException(`Некорректные часы для дня ${item.weekday}: открытие должно быть раньше закрытия`);
      }
    }
    const items = await this.prisma.$transaction(async (tx) => {
      await tx.gymWorkingHours.deleteMany({ where: { gymId: actor.gymId } });
      if (dto.items.length === 0) return [];
      return tx.gymWorkingHours.createMany({
        data: dto.items.map((i) => ({ gymId: actor.gymId, weekday: i.weekday, open: i.open, close: i.close })),
      });
    });
    await this.activityLog.log(
      actor,
      'Изменил часы работы точки',
      '',
      dto.items.length === 0
        ? 'ограничения сняты'
        : dto.items.map((i) => `${i.weekday}: ${i.open}–${i.close}`).join(', '),
    );
    return this.listWorkingHours(actor.gymId);
  }
}
