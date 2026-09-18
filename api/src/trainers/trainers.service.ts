import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateCredentialDto, UpdateCredentialDto } from './dto/credential.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import type { JwtPayload } from '../auth/auth.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { GymsService } from '../gyms/gyms.service';
import { ConsentsService } from '../consents/consents.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BulkClientsAction, BulkClientsDto } from './dto/bulk-clients.dto';
import { BulkSlotsAction, BulkSlotsDto } from './dto/bulk-slots.dto';
import { SetAvailabilityDto, TrainerAvailabilityMode } from './dto/set-availability.dto';
import { isMinor as computeIsMinor } from '../clients/age.util';

@Injectable()
export class TrainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
    private readonly gyms: GymsService,
    private readonly consents: ConsentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async findMe(actor: JwtPayload) {
    const trainer = await this.prisma.trainer.findUnique({
      where: { userId: actor.sub },
      include: { workHours: true, credentials: true, competitionPhotos: true },
    });
    if (!trainer) throw new ForbiddenException('У пользователя нет карточки тренера');
    return trainer;
  }

  async findMyClients(actor: JwtPayload) {
    const trainer = await this.prisma.trainer.findUnique({ where: { userId: actor.sub } });
    if (!trainer) throw new ForbiddenException('У пользователя нет карточки тренера');
    return this.prisma.client.findMany({
      where: { trainerId: trainer.id },
      include: { membership: true },
      orderBy: { name: 'asc' },
    });
  }

  async createLogin(actor: JwtPayload, trainerId: string, dto: CreateLoginDto) {
    const trainer = await this.findOne(actor, trainerId);
    if (trainer.userId) throw new BadRequestException('У тренера уже есть учётная запись');
    // Логин заводится в ДОМАШНЕЙ точке тренера, а не в той, где сейчас
    // находится CEO: с сетевым охватом карточки (P1.7) это может быть
    // другая точка сети.
    const user = await this.auth.createUser(trainer.gymId, dto.email, dto.password, 'TRAINER');
    await this.prisma.trainer.update({ where: { id: trainerId }, data: { userId: user.id } });
    await this.activityLog.log(actor, 'Выдал доступ в приложение', trainer.name, dto.email);
    await this.email.send(
      dto.email,
      'Доступ в приложение SiberianGym',
      `Здравствуйте, ${trainer.name}!\n\nВам открыт доступ в личный кабинет SiberianGym.\nEmail для входа: ${dto.email}\nПароль: ${dto.password}\n\nРекомендуем сменить пароль после первого входа.`,
    );
    return { ok: true };
  }

  // "На этой точке" (P1.3) значит: домашняя точка ИЛИ явно назначенная
  // дополнительная (TrainerGym) — тренер продолжает работать как раньше,
  // если у него вообще нет ни одной дополнительной точки.
  private static scopeToGym(gymId: string) {
    return { OR: [{ gymId }, { additionalGyms: { some: { gymId } } }] };
  }

  private static scopeToGyms(gymIds: string[]) {
    return { OR: [{ gymId: { in: gymIds } }, { additionalGyms: { some: { gymId: { in: gymIds } } } }] };
  }

  // Охват списка/карточки тренера (P1.7): CEO — вся сеть (отчёты и
  // занятость без раздельного захода в каждую точку; карточка из сетевого
  // списка не должна открываться 404), остальным ролям — как раньше,
  // строго "на этой точке".
  private async scopeForActor(actor: JwtPayload) {
    if (actor.role !== 'CEO') return TrainersService.scopeToGym(actor.gymId);
    return TrainersService.scopeToGyms(await this.gyms.resolveNetworkGymIds(actor));
  }

  // additionalGyms приложен для CEO-фильтра «тренер работает на выбранной
  // точке» (домашняя или дополнительная).
  async findAll(actor: JwtPayload) {
    return this.prisma.trainer.findMany({
      where: await this.scopeForActor(actor),
      include: { workHours: true, credentials: true, competitionPhotos: true, additionalGyms: { select: { gymId: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(actor: JwtPayload, id: string) {
    const trainer = await this.prisma.trainer.findFirst({
      where: { id, ...(await this.scopeForActor(actor)) },
      include: { clients: true, workHours: true, credentials: true, competitionPhotos: true },
    });
    if (!trainer) throw new NotFoundException('Тренер не найден');
    return trainer;
  }

  async listCredentialAlerts(actor: JwtPayload, days = 30) {
    const safeDays = Number.isFinite(days) ? Math.min(365, Math.max(0, Math.trunc(days))) : 30;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const until = new Date(today);
    until.setDate(until.getDate() + safeDays);
    const credentials = await this.prisma.trainerCredential.findMany({
      where: {
        trainer: await this.scopeForActor(actor),
        expiresAt: { lte: until },
      },
      include: { trainer: { select: { id: true, name: true } } },
      orderBy: { expiresAt: 'asc' },
    });
    return credentials.map((credential) => ({
      ...credential,
      status: credential.expiresAt && credential.expiresAt < today ? 'EXPIRED' : 'EXPIRING_SOON',
    }));
  }

  async createCredential(actor: JwtPayload, trainerId: string, dto: CreateCredentialDto) {
    const trainer = await this.findOne(actor, trainerId);
    const credential = await this.prisma.trainerCredential.create({
      data: {
        trainerId,
        title: dto.title,
        issuedBy: dto.issuedBy,
        year: dto.year,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isRequired: dto.isRequired ?? false,
      },
    });
    await this.activityLog.log(actor, 'Добавил сертификат тренеру', trainer.name, dto.title);
    return credential;
  }

  async updateCredential(actor: JwtPayload, trainerId: string, credentialId: string, dto: UpdateCredentialDto) {
    const trainer = await this.findOne(actor, trainerId);
    const existing = await this.prisma.trainerCredential.findFirst({ where: { id: credentialId, trainerId } });
    if (!existing) throw new NotFoundException('Сертификат не найден');
    const credential = await this.prisma.trainerCredential.update({
      where: { id: credentialId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.issuedBy !== undefined ? { issuedBy: dto.issuedBy } : {}),
        ...(dto.year !== undefined ? { year: dto.year } : {}),
        ...(dto.expiresAt !== undefined ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
      },
    });
    await this.activityLog.log(actor, 'Изменил сертификат тренера', trainer.name, credential.title);
    return credential;
  }

  async deleteCredential(actor: JwtPayload, trainerId: string, credentialId: string) {
    const trainer = await this.findOne(actor, trainerId);
    const existing = await this.prisma.trainerCredential.findFirst({ where: { id: credentialId, trainerId } });
    if (!existing) throw new NotFoundException('Сертификат не найден');
    await this.prisma.trainerCredential.delete({ where: { id: credentialId } });
    await this.activityLog.log(actor, 'Удалил сертификат тренера', trainer.name, existing.title);
    return { ok: true };
  }

  // Используется расписанием (schedule.service.ts) — та же проверка "тренер
  // реально работает на этой точке", не только владелец её создаёт.
  async assertTrainerAtGym(trainerId: string, gymId: string) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, ...TrainersService.scopeToGym(gymId) } });
    if (!trainer) throw new NotFoundException('Тренер не найден на этой точке');
    return trainer;
  }

  // Список точек тренера (домашняя + дополнительные) — для карточки в CEO-кабинете.
  async listGyms(actor: JwtPayload, trainerId: string) {
    const trainer = await this.findOne(actor, trainerId);
    const additional = await this.prisma.trainerGym.findMany({ where: { trainerId }, include: { gym: true } });
    return { homeGymId: trainer.gymId, additional: additional.map((a) => a.gym) };
  }

  // Назначение на дополнительную точку сети (P1.3) — только точки СВОЕЙ
  // сети (проверяется через networkId, а не по параметру запроса).
  async assignToGym(actor: JwtPayload, trainerId: string, gymId: string) {
    await this.gyms.assertBelongsToOwnedNetwork(actor, gymId);
    const trainer = await this.findOne(actor, trainerId);
    if (trainer.gymId === gymId) throw new BadRequestException('Это и так домашняя точка тренера');
    await this.prisma.trainerGym.upsert({
      where: { trainerId_gymId: { trainerId, gymId } },
      create: { trainerId, gymId },
      update: {},
    });
    await this.activityLog.log(actor, 'Назначил тренера на точку сети', trainer.name, `id точки: ${gymId}`);
    return { ok: true };
  }

  async unassignFromGym(actor: JwtPayload, trainerId: string, gymId: string) {
    const trainer = await this.findOne(actor, trainerId);
    await this.prisma.trainerGym.delete({ where: { trainerId_gymId: { trainerId, gymId } } }).catch(() => {});
    await this.activityLog.log(actor, 'Снял тренера с точки сети', trainer.name, `id точки: ${gymId}`);
    return { ok: true };
  }

  // P1.4 — "в один проход": карточка + статус занятости + точки сети +
  // согласие сотрудника + логин, вместо нескольких отдельных действий.
  async setAvailability(actor: JwtPayload, trainerId: string, dto: SetAvailabilityDto) {
    const trainer = await this.findOne(actor, trainerId);
    const from = dto.from ? new Date(dto.from) : null;
    const until = dto.until ? new Date(dto.until) : null;

    if (dto.mode === TrainerAvailabilityMode.UNAVAILABLE) {
      if (!from || !until || from > until) throw new BadRequestException('Для недоступности укажите корректный диапазон дат');
    }
    if (dto.mode === TrainerAvailabilityMode.ACTIVE && (from || until)) {
      throw new BadRequestException('Для статуса ACTIVE диапазон дат не нужен');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.trainer.update({
        where: { id: trainerId },
        data: {
          unavailableFrom: dto.mode === TrainerAvailabilityMode.UNAVAILABLE ? from : null,
          unavailableUntil: dto.mode === TrainerAvailabilityMode.UNAVAILABLE ? until : null,
          departedAt: dto.mode === TrainerAvailabilityMode.DEPARTED ? new Date() : null,
          ...(trainer.userId ? { user: { update: { isActive: dto.mode !== TrainerAvailabilityMode.DEPARTED } } } : {}),
        },
      });
      if (dto.mode === TrainerAvailabilityMode.DEPARTED) {
        await tx.personalSlot.deleteMany({ where: { trainerId, date: { gte: new Date() }, status: 'FREE' } });
        await tx.groupClass.deleteMany({ where: { trainerId, date: { gte: new Date() }, bookings: { none: {} } } });
      }
      return result;
    });
    await this.activityLog.log(actor, dto.mode === TrainerAvailabilityMode.DEPARTED ? 'Зафиксировал уход тренера' : dto.mode === TrainerAvailabilityMode.UNAVAILABLE ? 'Отметил недоступность тренера' : 'Вернул тренера в активный статус', trainer.name, dto.mode === TrainerAvailabilityMode.UNAVAILABLE ? `${dto.from} — ${dto.until}` : dto.mode);
    return updated;
  }

  async bulkSlots(actor: JwtPayload, trainerId: string, dto: BulkSlotsDto) {
    const trainer = await this.findOne(actor, trainerId);
    const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : new Date();
    if (dto.action === BulkSlotsAction.REASSIGN && !dto.targetTrainerId) throw new BadRequestException('Для переназначения укажите целевого тренера');
    if (dto.targetTrainerId === trainerId) throw new BadRequestException('Нельзя переназначить тренеру самого себя');

    const target = dto.targetTrainerId ? await this.findOne(actor, dto.targetTrainerId) : null;
    if (target?.departedAt || target?.unavailableFrom) throw new BadRequestException('Целевой тренер недоступен');
    const slots = await this.prisma.personalSlot.findMany({ where: { trainerId, date: { gte: dateFrom }, status: { in: ['FREE', 'BOOKED'] } }, include: { trainer: true } });
    const result = { processed: 0, reassigned: 0, cancelled: 0, skipped: 0 };

    for (const slot of slots) {
      if (dto.action === BulkSlotsAction.CANCEL) {
        if (slot.status === 'BOOKED' && slot.clientId) {
          await this.prisma.personalSlot.update({ where: { id: slot.id }, data: { status: 'FREE', clientId: null } });
          await this.notifications.notify(slot.clientId, 'SLOT_CANCELLED', 'Персональная тренировка отменена', `Слот ${slot.date.toISOString().slice(0, 10)} ${slot.start} у тренера ${trainer.name} отменён. Запишитесь на другое время.`, slot.id);
          result.cancelled++;
        } else {
          await this.prisma.personalSlot.delete({ where: { id: slot.id } });
          result.cancelled++;
        }
        result.processed++;
        continue;
      }

      const targetBusy = await this.prisma.personalSlot.findFirst({ where: { trainerId: dto.targetTrainerId!, date: slot.date, start: { lt: slot.end }, end: { gt: slot.start } } });
      const targetClass = await this.prisma.groupClass.findFirst({ where: { trainerId: dto.targetTrainerId!, date: slot.date, start: { lt: slot.end }, end: { gt: slot.start } } });
      if (targetBusy || targetClass) {
        result.skipped++;
        continue;
      }
      await this.prisma.personalSlot.update({ where: { id: slot.id }, data: { trainerId: dto.targetTrainerId } });
      if (slot.clientId) await this.notifications.notify(slot.clientId, 'TRAINER_CHANGED', 'Тренер изменён', `Ваша персональная тренировка ${slot.date.toISOString().slice(0, 10)} в ${slot.start} перенесена к тренеру ${target!.name}.`, slot.id);
      result.reassigned++;
      result.processed++;
    }
    await this.activityLog.log(actor, 'Массово обработал персональные слоты тренера', trainer.name, JSON.stringify(result));
    return result;
  }

  async bulkClients(actor: JwtPayload, trainerId: string, dto: BulkClientsDto) {
    const trainer = await this.findOne(actor, trainerId);
    if (dto.action === BulkClientsAction.REASSIGN && !dto.targetTrainerId) throw new BadRequestException('Для переназначения укажите целевого тренера');
    if (dto.targetTrainerId === trainerId) throw new BadRequestException('Нельзя переназначить тренеру самого себя');
    const target = dto.targetTrainerId ? await this.findOne(actor, dto.targetTrainerId) : null;
    if (target?.departedAt || target?.unavailableFrom) throw new BadRequestException('Целевой тренер недоступен');
    const clients = await this.prisma.client.findMany({ where: { trainerId }, select: { id: true, name: true, birthday: true, trainerId: true, format: true, tariff: true } });
    const result = { processed: 0, reassigned: 0, self: 0, skipped: 0 };
    const today = new Date();
    const minAge = (await this.prisma.gym.findUniqueOrThrow({ where: { id: actor.gymId }, select: { selfTrainingMinAge: true } })).selfTrainingMinAge;

    for (const client of clients) {
      if (dto.action === BulkClientsAction.SELF) {
        if (computeIsMinor(client.birthday, minAge)) { result.skipped++; continue; }
        await this.prisma.$transaction([
          this.prisma.clientFormatHistoryEntry.updateMany({ where: { clientId: client.id, to: null }, data: { to: today } }),
          this.prisma.clientFormatHistoryEntry.create({ data: { clientId: client.id, trainerId: null, format: 'SELF', from: today, to: null, reason: 'TRAINER_DEPARTED' } }),
          this.prisma.client.update({ where: { id: client.id }, data: { trainerId: null, tariff: null, format: 'SELF' } }),
        ]);
        result.self++;
        result.processed++;
        continue;
      }
      await this.prisma.$transaction([
        this.prisma.clientFormatHistoryEntry.updateMany({ where: { clientId: client.id, to: null }, data: { to: today } }),
        this.prisma.clientFormatHistoryEntry.create({ data: { clientId: client.id, trainerId: dto.targetTrainerId, format: client.format, from: today, to: null, reason: 'TRAINER_CHANGED' } }),
        this.prisma.client.update({ where: { id: client.id }, data: { trainerId: dto.targetTrainerId } }),
      ]);
      await this.notifications.notify(client.id, 'TRAINER_CHANGED', 'Тренер изменён', `Ваш тренер ${trainer.name} заменён на ${target!.name}.`, dto.targetTrainerId);
      result.reassigned++;
      result.processed++;
    }
    await this.activityLog.log(actor, 'Массово переназначил подопечных тренера', trainer.name, JSON.stringify(result));
    return result;
  }

  async create(actor: JwtPayload, dto: CreateTrainerDto) {
    const trainer = await this.prisma.trainer.create({
      data: {
        gymId: actor.gymId,
        name: dto.name,
        specialization: dto.specialization,
        bio: dto.bio,
        experienceYears: dto.experienceYears ?? 0,
        personalSessionPrice: dto.personalSessionPrice,
        avatarHue: Math.floor(Math.random() * 360),
        employmentType: dto.employmentType,
        revenueSharePercent: dto.revenueSharePercent,
      },
    });
    await this.activityLog.log(actor, 'Добавил тренера', trainer.name, dto.specialization);

    // Назначение на доп. точки сразу при заведении — только CEO
    // (владелец сети); STAFF заводит тренера строго в рамках своей
    // текущей точки, без права раскидать его по всей сети.
    if (dto.additionalGymIds?.length) {
      if (actor.role !== 'CEO') {
        throw new ForbiddenException('Назначить тренера на несколько точек сети может только CEO');
      }
      for (const gymId of dto.additionalGymIds) {
        await this.assignToGym(actor, trainer.id, gymId);
      }
    }

    if (dto.staffConsentGranted) {
      await this.consents.grantForTrainer(actor, trainer.id);
    }

    if (dto.loginEmail && dto.loginPassword) {
      await this.createLogin(actor, trainer.id, { email: dto.loginEmail, password: dto.loginPassword });
    }

    return trainer;
  }
}
