import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import { formatForTariff, VALIDITY_DAYS, VISITS_TOTAL } from './membership.const';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
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
    await this.email.send(
      dto.email,
      'Доступ в приложение SiberianGym',
      `Здравствуйте, ${client.name}!\n\nВам открыт доступ в личный кабинет SiberianGym.\nEmail для входа: ${dto.email}\nПароль: ${dto.password}\n\nРекомендуем сменить пароль после первого входа.`,
    );
    return { ok: true };
  }

  findAll(gymId: string) {
    return this.prisma.client.findMany({
      where: { gymId },
      include: { membership: true, trainer: true, formatHistory: true },
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

  // Смена/выбор тренера и тарифа, а также оформление/продление абонемента
  // раньше жили здесь и сразу создавали Transaction, доверяя администратору
  // на слово, что деньги приняты. С P0.2 это платные действия и применяются
  // только через OrdersService.applyLine, после подтверждения оплаты
  // отсканированным кассовым чеком — см. api/src/orders/orders.service.ts
  // (TARIFF_CHANGE и MEMBERSHIP_PURCHASE/MEMBERSHIP_RENEWAL).

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
}
