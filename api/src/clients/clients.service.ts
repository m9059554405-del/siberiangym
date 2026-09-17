import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Membership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import {
  addDays,
  diffInDays,
  effectiveMembershipStatus,
  formatForTariff,
  FREEZE_LIMIT_DAYS,
  startOfDay,
  VALIDITY_DAYS,
  VISITS_TOTAL,
} from './membership.const';
import { isMinor as computeIsMinor } from './age.util';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import type { JwtPayload } from '../auth/auth.service';
import { GymsService } from '../gyms/gyms.service';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
    private readonly gyms: GymsService,
  ) {}

  // Межточечный поиск клиента (P1.5) — клиент с NETWORK-абонементом может
  // прийти на любую точку сети, но карточка по-прежнему физически живёт в
  // gymId своей "домашней" точки (полноценный пересмотр этого — за рамками
  // одного пункта, см. P1.6/P1.8). Здесь — минимум для того, чтобы
  // администратор чужой точки мог узнать клиента и увидеть, действует ли
  // его абонемент именно здесь, а не только "на глаз", как раньше.
  async networkSearch(actor: JwtPayload, query: string) {
    const q = query.trim();
    if (q.length < 2) return [];
    const networkId = await this.gyms.resolveNetworkId(actor);
    const gyms = await this.prisma.gym.findMany({ where: { networkId }, select: { id: true, name: true } });
    const gymNameById = new Map(gyms.map((g) => [g.id, g.name]));
    const clients = await this.prisma.client.findMany({
      where: {
        gymId: { in: gyms.map((g) => g.id) },
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }],
      },
      include: { membership: true },
      orderBy: { name: 'asc' },
      take: 20,
    });
    return clients.map((c) => {
      const membership = c.membership ? { ...c.membership, status: effectiveMembershipStatus(c.membership) } : null;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        gymId: c.gymId,
        gymName: gymNameById.get(c.gymId) ?? null,
        isHomeGym: c.gymId === actor.gymId,
        membership,
        // Валидно именно здесь (P1.5): сетевой абонемент действует на любой
        // точке; "своя точка" — только там, где карточка физически заведена.
        // Статус — эффективный: закончилась заморозка = снова действует.
        validHere: !!membership && membership.status === 'ACTIVE' && (membership.scope === 'NETWORK' || c.gymId === actor.gymId),
      };
    });
  }

  // Выдаёт клиенту доступ в личный кабинет — создаёт учётную запись и
  // привязывает её к уже существующей карточке клиента. Карточка может
  // жить какое-то время без логина (администратор завёл клиента "с улицы",
  // доступ в приложение оформляется отдельно).
  async createLogin(actor: JwtPayload, clientId: string, dto: CreateLoginDto) {
    const client = await this.findOne(actor.gymId, clientId);
    if (client.userId) throw new BadRequestException('У клиента уже есть учётная запись');
    const user = await this.auth.createUser(actor.gymId, dto.email, dto.password, 'CLIENT');
    await this.prisma.client.update({ where: { id: clientId }, data: { userId: user.id } });
    await this.activityLog.log(actor, 'Выдал доступ в приложение', client.name, dto.email);
    await this.email.send(
      dto.email,
      'Доступ в приложение SiberianGym',
      `Здравствуйте, ${client.name}!\n\nВам открыт доступ в личный кабинет SiberianGym.\nEmail для входа: ${dto.email}\nПароль: ${dto.password}\n\nРекомендуем сменить пароль после первого входа.`,
    );
    return { ok: true };
  }

  // Возраст, с которого клиент зала может тренироваться самостоятельно
  // (P0.6) — настраивается на уровне зала, читается лениво, не кэшируется
  // между запросами (значение меняется редко, а некорректный кэш в вопросе
  // "можно ли ребёнку тренироваться одному" — не тот риск, на котором
  // стоит экономить один короткий запрос).
  private async getSelfTrainingMinAge(gymId: string): Promise<number> {
    const gym = await this.prisma.gym.findUniqueOrThrow({ where: { id: gymId }, select: { selfTrainingMinAge: true } });
    return gym.selfTrainingMinAge;
  }

  private attachIsMinor<T extends { birthday: Date | null }>(client: T, minAge: number): T & { isMinor: boolean | null } {
    return { ...client, isMinor: computeIsMinor(client.birthday, minAge) };
  }

  // «Ленивая» разморозка (P2.1): статус FROZEN лежит в БД до первой
  // записи, дожимать его планировщиком некому — поэтому наружу карточка
  // клиента всегда отдаёт эффективный статус: заморозка закончилась,
  // значит абонемент уже снова действует. Мутирует только копию ответа.
  private attachEffectiveMembershipStatus<T extends { membership: Membership | null }>(client: T): T {
    if (!client.membership) return client;
    return { ...client, membership: { ...client.membership, status: effectiveMembershipStatus(client.membership) } };
  }

  // ?network=1 (P1.7) — вся сеть, но только для CEO: отчёту «занятость
  // тренеров» нужны подопечные из всех точек, ведь клиенты тренера живут
  // в разных залах. STAFF всегда видит строго свою точку, а поштучные
  // действия (update, go-self-training, create-login) остаются
  // gym-scoped — сетевой список только для чтения. Порог
  // самостоятельных тренировок у каждой точки свой, поэтому isMinor
  // считается по точке каждого клиента.
  async findAll(actor: JwtPayload, network = false) {
    if (network && actor.role === 'CEO') {
      const gyms = await this.prisma.gym.findMany({
        where: { networkId: await this.gyms.resolveNetworkId(actor) },
        select: { id: true, selfTrainingMinAge: true },
      });
      const minAgeByGym = new Map(gyms.map((g) => [g.id, g.selfTrainingMinAge]));
      const clients = await this.prisma.client.findMany({
        where: { gymId: { in: gyms.map((g) => g.id) } },
        include: { membership: true, trainer: true, formatHistory: true },
        orderBy: { createdAt: 'desc' },
      });
      return clients.map((c) => this.attachEffectiveMembershipStatus(this.attachIsMinor(c, minAgeByGym.get(c.gymId) ?? 18)));
    }
    const [clients, minAge] = await Promise.all([
      this.prisma.client.findMany({
        where: { gymId: actor.gymId },
        include: { membership: true, trainer: true, formatHistory: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.getSelfTrainingMinAge(actor.gymId),
    ]);
    return clients.map((c) => this.attachEffectiveMembershipStatus(this.attachIsMinor(c, minAge)));
  }

  async findOne(gymId: string, id: string) {
    const [client, minAge] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id, gymId },
        include: { membership: true, trainer: true, formatHistory: true },
      }),
      this.getSelfTrainingMinAge(gymId),
    ]);
    if (!client) throw new NotFoundException('Клиент не найден');
    return this.attachEffectiveMembershipStatus(this.attachIsMinor(client, minAge));
  }

  // Тренер видит только карточки своих подопечных.
  async findOneForActor(actor: JwtPayload, id: string) {
    const client = await this.findOne(actor.gymId, id);
    if (actor.role === 'TRAINER') {
      const trainer = await this.prisma.trainer.findUnique({ where: { userId: actor.sub } });
      if (!trainer || client.trainerId !== trainer.id) {
        throw new ForbiddenException('Можно смотреть только своих подопечных');
      }
    }
    return client;
  }

  // Собственная карточка клиента — резолвится по userId из токена, а не по
  // параметру запроса, чтобы клиент не мог подставить чужой id.
  async findMe(actor: JwtPayload) {
    const [client, minAge] = await Promise.all([
      this.prisma.client.findUnique({
        where: { userId: actor.sub },
        include: { membership: true, trainer: true, formatHistory: true },
      }),
      this.getSelfTrainingMinAge(actor.gymId),
    ]);
    if (!client) throw new NotFoundException('У пользователя нет карточки клиента');
    return this.attachEffectiveMembershipStatus(this.attachIsMinor(client, minAge));
  }

  // CEO/STAFF могут управлять любым клиентом зала. Сам клиент — только
  // своей собственной карточкой (используется в self-service действиях
  // вроде смены тарифа из личного кабинета).
  private async assertCanAct(actor: JwtPayload, client: { id: string; userId: string | null }) {
    if (actor.role === 'CEO' || actor.role === 'STAFF') return;
    if (actor.role === 'CLIENT' && client.userId === actor.sub) return;
    throw new ForbiddenException('Недостаточно прав для этого действия');
  }

  async create(actor: JwtPayload, dto: CreateClientDto) {
    const today = new Date();
    const format = formatForTariff(dto.tariff);
    const validityDays = VALIDITY_DAYS[dto.membershipType];
    const expiresAt = validityDays ? new Date(today.getTime() + validityDays * 86400000) : null;

    // Несовершеннолетнему клиенту доступен только формат "с тренером"
    // (P0.6, ГК РФ ст. 26/28) — на уровне API, а не только в интерфейсе:
    // карточка не должна сохраниться без выбранного тренера.
    const minAge = await this.getSelfTrainingMinAge(actor.gymId);
    if (computeIsMinor(new Date(dto.birthday), minAge) && !dto.trainerId) {
      throw new BadRequestException(
        `Клиенту младше ${minAge} лет недоступны самостоятельные тренировки — сначала выберите тренера`,
      );
    }

    const client = await this.prisma.client.create({
      data: {
        gymId: actor.gymId,
        name: dto.name,
        gender: dto.gender,
        birthday: new Date(dto.birthday),
        phone: dto.phone,
        email: dto.email,
        trainerId: dto.trainerId,
        tariff: dto.tariff,
        format,
        joinedAt: today,
        membership: {
          create: {
            type: dto.membershipType,
            purchasedAt: today,
            expiresAt,
            visitsTotal: VISITS_TOTAL[dto.membershipType],
            visitsLeft: VISITS_TOTAL[dto.membershipType],
            status: 'ACTIVE',
          },
        },
        formatHistory: {
          create: { trainerId: dto.trainerId, format, from: today, to: null },
        },
      },
      include: { membership: true },
    });

    await this.activityLog.log(
      actor,
      'Зарегистрировал клиента',
      client.name,
      dto.trainerId ? 'С тренером и абонементом' : 'Самостоятельные тренировки',
    );
    return this.attachIsMinor(client, minAge);
  }

  async update(actor: JwtPayload, id: string, dto: UpdateClientDto) {
    const before = await this.findOne(actor.gymId, id);
    await this.assertCanAct(actor, before);
    const minAge = await this.getSelfTrainingMinAge(actor.gymId);

    if (dto.birthday !== undefined && computeIsMinor(new Date(dto.birthday), minAge) && !before.trainerId) {
      throw new BadRequestException(
        `С такой датой рождения клиент младше ${minAge} лет — самостоятельные тренировки недоступны, сначала назначьте тренера`,
      );
    }

    const client = await this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.birthday !== undefined && { birthday: new Date(dto.birthday) }),
        ...(dto.profilePhotoUrl !== undefined && { profilePhotoUrl: dto.profilePhotoUrl }),
      },
    });
    await this.activityLog.log(actor, 'Изменил данные клиента', client.name, 'Профиль обновлён');
    return this.attachIsMinor(client, minAge);
  }

  // Смена/выбор тренера и тарифа, а также оформление/продление абонемента
  // раньше жили здесь и сразу создавали Transaction, доверяя администратору
  // на слово, что деньги приняты. С P0.2 это платные действия и применяются
  // только через OrdersService.applyLine, после подтверждения оплаты
  // отсканированным кассовым чеком — см. api/src/orders/orders.service.ts
  // (TARIFF_CHANGE и MEMBERSHIP_PURCHASE/MEMBERSHIP_RENEWAL).

  async goSelfTraining(actor: JwtPayload, clientId: string) {
    const client = await this.findOne(actor.gymId, clientId);
    await this.assertCanAct(actor, client);
    // Блокировка на уровне API (P0.6), а не только в интерфейсе — иначе
    // прямой вызов эндпоинта в обход UI мог бы снять несовершеннолетнему
    // клиенту тренера, оставив его без обязательного сопровождения.
    if (client.isMinor) {
      const minAge = await this.getSelfTrainingMinAge(actor.gymId);
      throw new ForbiddenException(`Самостоятельные тренировки недоступны младше ${minAge} лет — занятия только с тренером`);
    }
    const today = new Date();

    await this.prisma.$transaction([
      this.prisma.clientFormatHistoryEntry.updateMany({ where: { clientId, to: null }, data: { to: today } }),
      this.prisma.clientFormatHistoryEntry.create({
        data: { clientId, trainerId: null, format: 'SELF', from: today, to: null },
      }),
      this.prisma.client.update({ where: { id: clientId }, data: { trainerId: null, tariff: null, format: 'SELF' } }),
    ]);

    await this.activityLog.log(actor, 'Перешёл на самостоятельные тренировки', client.name, 'Тренер и тариф сняты');
    return this.findOne(actor.gymId, clientId);
  }

  // Заморозка абонемента (P2.1): болезнь/отпуск. Срок действия
  // продлевается на число дней заморозки сразу, лимит дней — на один
  // оплаченный период (сбрасывается новой покупкой/продлением).
  // Развилки, решённые здесь явно:
  //  - брони на замороженный период НЕ отменяются автоматически: групповые
  //    и персональные занятия уже оплачены чеком (P0.2), отмена — отдельное
  //    ручное действие администратора, а не побочный эффект заморозки;
  //  - графика платежей рассрочки в модели пока нет (P0.8 не реализован),
  //    сдвигать нечего — при появлении рассрочки учесть здесь;
  //  - новый период при продлении всегда считается от даты оплаты
  //    (текущее поведение OrdersService), заморозка продлевает только
  //    текущий срок и на будущие покупки не переносится.
  async freezeMembership(actor: JwtPayload, clientId: string, days: number) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId }, include: { membership: true } });
    if (!client) throw new NotFoundException('Клиент не найден');
    const m = client.membership;
    if (!m) throw new BadRequestException('У клиента нет абонемента — замораживать нечего');

    const today = startOfDay(new Date());
    if (effectiveMembershipStatus(m) === 'FROZEN') {
      throw new ConflictException(`Абонемент уже заморожен до ${m.freezeEndsAt!.toISOString().slice(0, 10)} — сначала разморозьте его`);
    }
    if (!m.expiresAt) throw new BadRequestException('Разовое посещение не имеет срока действия — заморозка не применима');
    if (diffInDays(today, m.expiresAt) <= 0) throw new BadRequestException('Срок абонемента уже истёк — сначала продлите его, заморозка не имеет смысла');

    const limit = FREEZE_LIMIT_DAYS[m.type];
    if (limit === 0) throw new BadRequestException('Абонемент этого типа замораживать нельзя');
    const remaining = limit - m.frozenDaysUsed;
    if (days > remaining) {
      throw new BadRequestException(
        remaining > 0
          ? `Лимит заморозки для этого абонемента — ${limit} дн., использовано ${m.frozenDaysUsed} дн., доступно ещё ${remaining} дн.`
          : `Лимит заморозки для этого абонемента (${limit} дн.) уже израсходован полностью`,
      );
    }

    // Заморозка начинается сегодня, freezeEndsAt — первый день, когда
    // абонемент снова действует. expiresAt двигаем на те же дни вперёд.
    const freezeEndsAt = addDays(today, days);
    const expiresAt = addDays(m.expiresAt, days);
    const updated = await this.prisma.membership.update({
      where: { clientId },
      data: { status: 'FROZEN', freezeEndsAt, expiresAt, frozenDaysUsed: { increment: days } },
    });
    await this.activityLog.log(
      actor,
      'Заморозил абонемент',
      client.name,
      `${days} дн., по ${addDays(freezeEndsAt, -1).toISOString().slice(0, 10)}; срок действия продлён до ${expiresAt.toISOString().slice(0, 10)}`,
    );
    return updated;
  }

  // Досрочная разморозка (P2.1): неизрасходованные дни возвращаются и в
  // срок абонемента, и в лимит заморозки — клиент не должен терять дни,
  // которыми не воспользовался. Заморозка, чей срок уже прошёл, здесь
  // просто приводит строку в БД к фактическому состоянию (ACTIVE).
  async unfreezeMembership(actor: JwtPayload, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId }, include: { membership: true } });
    if (!client) throw new NotFoundException('Клиент не найден');
    const m = client.membership;
    if (!m) throw new BadRequestException('У клиента нет абонемента');
    if (m.status !== 'FROZEN') throw new BadRequestException('Абонемент не заморожен');

    const today = startOfDay(new Date());
    const data: { status: 'ACTIVE'; freezeEndsAt: null; expiresAt?: Date; frozenDaysUsed?: number } = {
      status: 'ACTIVE',
      freezeEndsAt: null,
    };
    let detail = 'Заморозка уже закончилась к моменту разморозки — срок не менялся';
    if (m.freezeEndsAt && m.expiresAt) {
      const left = diffInDays(today, m.freezeEndsAt);
      if (left > 0) {
        data.expiresAt = addDays(m.expiresAt, -left);
        data.frozenDaysUsed = Math.max(0, m.frozenDaysUsed - left);
        detail = `Досрочно, на ${left} дн. раньше; срок действия возвращён к ${data.expiresAt.toISOString().slice(0, 10)}`;
      }
    }
    const updated = await this.prisma.membership.update({ where: { clientId }, data });
    await this.activityLog.log(actor, 'Разморозил абонемент', client.name, detail);
    return updated;
  }
}
