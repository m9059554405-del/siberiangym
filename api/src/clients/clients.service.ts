import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClientFormat, MembershipType, Tariff } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import { TARIFF_NAME, TARIFF_PRICE } from './tariffs.const';
import { AuthService } from '../auth/auth.service';
import type { JwtPayload } from '../auth/auth.service';

const VALIDITY_DAYS: Record<MembershipType, number | null> = {
  SINGLE: null,
  MONTHLY: 30,
  PACK10: 90,
  PACK20: 120,
};
const VISITS_TOTAL: Record<MembershipType, number | null> = {
  SINGLE: null,
  MONTHLY: null,
  PACK10: 10,
  PACK20: 20,
};
const MEMBERSHIP_LABEL: Record<MembershipType, string> = {
  SINGLE: 'Разовое посещение',
  MONTHLY: 'Абонемент на месяц',
  PACK10: 'Абонемент на 10 занятий',
  PACK20: 'Абонемент на 20 занятий',
};

function formatForTariff(tariff: Tariff | undefined | null): ClientFormat {
  if (!tariff) return ClientFormat.SELF;
  return tariff === Tariff.INDIVIDUAL ? ClientFormat.PERSONAL : ClientFormat.GROUP;
}

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly auth: AuthService,
  ) {}

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
    return { ok: true };
  }

  findAll(gymId: string) {
    return this.prisma.client.findMany({
      where: { gymId },
      include: { membership: true, trainer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(gymId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, gymId },
      include: { membership: true, trainer: true, formatHistory: true },
    });
    if (!client) throw new NotFoundException('Клиент не найден');
    return client;
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
    const client = await this.prisma.client.findUnique({
      where: { userId: actor.sub },
      include: { membership: true, trainer: true, formatHistory: true },
    });
    if (!client) throw new NotFoundException('У пользователя нет карточки клиента');
    return client;
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
    return client;
  }

  async update(actor: JwtPayload, id: string, dto: UpdateClientDto) {
    const before = await this.findOne(actor.gymId, id);
    await this.assertCanAct(actor, before);
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
    return client;
  }

  async chooseTrainer(actor: JwtPayload, clientId: string, trainerId: string, tariff: Tariff) {
    const client = await this.findOne(actor.gymId, clientId);
    await this.assertCanAct(actor, client);
    const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, gymId: actor.gymId } });
    if (!trainer) throw new NotFoundException('Тренер не найден');

    const today = new Date();
    const format = formatForTariff(tariff);

    await this.prisma.$transaction([
      this.prisma.clientFormatHistoryEntry.updateMany({
        where: { clientId, to: null },
        data: { to: today },
      }),
      this.prisma.clientFormatHistoryEntry.create({
        data: { clientId, trainerId, format, from: today, to: null },
      }),
      this.prisma.client.update({ where: { id: clientId }, data: { trainerId, tariff, format } }),
      this.prisma.transaction.create({
        data: {
          gymId: actor.gymId,
          amount: TARIFF_PRICE[tariff],
          category: 'PERSONAL',
          clientId,
          trainerId,
          description: `Тариф «${TARIFF_NAME[tariff]}» — ${trainer.name}`,
        },
      }),
    ]);

    await this.activityLog.log(actor, 'Выбрал тренера', client.name, `Тренер: ${trainer.name}, тариф «${TARIFF_NAME[tariff]}»`);
    return this.findOne(actor.gymId, clientId);
  }

  async changeTariff(actor: JwtPayload, clientId: string, tariff: Tariff) {
    const client = await this.findOne(actor.gymId, clientId);
    await this.assertCanAct(actor, client);
    if (!client.trainerId) throw new ForbiddenException('У клиента нет тренера — сначала выберите тренера');

    const today = new Date();
    const format = formatForTariff(tariff);
    const formatChanged = format !== client.format;

    const ops = [];
    if (formatChanged) {
      ops.push(
        this.prisma.clientFormatHistoryEntry.updateMany({ where: { clientId, to: null }, data: { to: today } }),
        this.prisma.clientFormatHistoryEntry.create({
          data: { clientId, trainerId: client.trainerId, format, from: today, to: null },
        }),
      );
    }
    ops.push(
      this.prisma.client.update({ where: { id: clientId }, data: { tariff, ...(formatChanged && { format }) } }),
      this.prisma.transaction.create({
        data: {
          gymId: actor.gymId,
          amount: TARIFF_PRICE[tariff],
          category: 'PERSONAL',
          clientId,
          trainerId: client.trainerId,
          description: `Смена тарифа на «${TARIFF_NAME[tariff]}»`,
        },
      }),
    );
    await this.prisma.$transaction(ops);

    await this.activityLog.log(actor, 'Сменил тариф', client.name, `Новый тариф: «${TARIFF_NAME[tariff]}»`);
    return this.findOne(actor.gymId, clientId);
  }

  async goSelfTraining(actor: JwtPayload, clientId: string) {
    const client = await this.findOne(actor.gymId, clientId);
    await this.assertCanAct(actor, client);
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

  async purchaseMembership(actor: JwtPayload, clientId: string, type: MembershipType) {
    const client = await this.findOne(actor.gymId, clientId);
    await this.assertCanAct(actor, client);

    const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId: actor.gymId } });
    const price =
      type === 'SINGLE' ? pricing?.single
      : type === 'MONTHLY' ? pricing?.monthly
      : type === 'PACK10' ? pricing?.pack10
      : pricing?.pack20;

    const today = new Date();
    const validityDays = VALIDITY_DAYS[type];
    const expiresAt = validityDays ? new Date(today.getTime() + validityDays * 86400000) : null;
    const visitsTotal = VISITS_TOTAL[type];

    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: { clientId },
        create: { clientId, type, purchasedAt: today, expiresAt, visitsTotal, visitsLeft: visitsTotal, status: 'ACTIVE' },
        update: { type, purchasedAt: today, expiresAt, visitsTotal, visitsLeft: visitsTotal, status: 'ACTIVE' },
      }),
      this.prisma.transaction.create({
        data: {
          gymId: actor.gymId,
          amount: price ?? 0,
          category: 'MEMBERSHIP',
          clientId,
          description: MEMBERSHIP_LABEL[type],
        },
      }),
    ]);

    await this.activityLog.log(
      actor,
      'Оформил/продлил абонемент',
      client.name,
      `${MEMBERSHIP_LABEL[type]}${expiresAt ? ` до ${expiresAt.toISOString().slice(0, 10)}` : ''}`,
    );
    return this.findOne(actor.gymId, clientId);
  }
}
