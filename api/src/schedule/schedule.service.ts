import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { EmailService } from '../email/email.service';
import { CreateGroupClassDto } from './dto/create-group-class.dto';
import { CreateGroupClassSeriesDto, UpdateGroupClassSeriesDto } from './dto/create-group-class-series.dto';
import { CreatePersonalSlotDto } from './dto/create-personal-slot.dto';
import type { JwtPayload } from '../auth/auth.service';
import { SlotStatus } from '@prisma/client';
import { TrainersService } from '../trainers/trainers.service';
import { GymsService } from '../gyms/gyms.service';
import { NotificationsService } from '../notifications/notifications.service';
import { startOfDay } from '../clients/membership.const';
import { SERIES_TOPUP_INTERVAL_MS, hoursBefore, lateCancelWindowHours, startsAt } from './schedule.const';
import { dayUtc, seriesWindowDates, weekdayIndex } from './series-dates.util';
import { overlaps, type TimeRange } from './time-overlap.util';
import { isDispatcherInstance } from '../common/dispatcher';

// Резолвит clientId для self-service действий: клиент может действовать
// только от своего имени, CEO/STAFF должны явно передать clientId.
async function resolveClientId(prisma: PrismaService, actor: JwtPayload, explicit?: string): Promise<string> {
  if (actor.role === 'CLIENT') {
    const client = await prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return client.id;
  }
  if (!explicit) throw new BadRequestException('Не указан clientId');
  return explicit;
}

@Injectable()
export class ScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ScheduleService.name);
  private topUpTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly trainers: TrainersService,
    private readonly gyms: GymsService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
  ) {}

  // Тренер на нескольких точках сети (P1.3) должен видеть свой календарь
  // целиком, без переключения точки; CEO с P1.7 видит расписание сети
  // целиком (основа отчётов «посещаемость» и «занятость тренеров» без
  // раздельного захода в каждую точку). Клиенту и STAFF список остаётся
  // строго про их текущую точку по токену, как и раньше.
  private async gymIdsForActor(actor: JwtPayload): Promise<string[]> {
    if (actor.role === 'CEO') return this.gyms.resolveNetworkGymIds(actor);
    if (actor.role !== 'TRAINER') return [actor.gymId];
    const trainer = await this.prisma.trainer.findUnique({ where: { userId: actor.sub }, include: { additionalGyms: true } });
    if (!trainer) return [actor.gymId];
    return [trainer.gymId, ...trainer.additionalGyms.map((g) => g.gymId)];
  }

  // --- Групповые занятия ---

  async listGroupClasses(actor: JwtPayload) {
    const gymIds = await this.gymIdsForActor(actor);
    return this.prisma.groupClass.findMany({
      where: { gymId: { in: gymIds } },
      include: { trainer: true, bookings: true, waitlist: true },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
  }

  // P2.7: время тренера — неделимый ресурс всей сети, а не точки: тренер
  // работает на нескольких площадках (P1.3), и слоты/группы в разных
  // gyms не должны пересекаться по времени. Проверяется при создании
  // любой новой активности тренера (слот или групповое занятие).
  private assertTrainerAvailable(trainer: { departedAt: Date | null; unavailableFrom: Date | null; unavailableUntil: Date | null }, date: Date) {
    const clash = this.trainerUnavailableOn(trainer, date);
    if (clash === 'DEPARTED') throw new BadRequestException('Тренер больше не принимает новые занятия');
    if (clash === 'UNAVAILABLE') throw new BadRequestException('Тренер недоступен в выбранную дату');
  }

  // Дата попадает в диапазон недоступности тренера (P2.10)? null — тренер
  // работает. Небросающий вариант assertTrainerAvailable: генератор серий
  // (P2.12) по тем же правилам не создаёт занятия, но молча пропускает
  // дату с причиной, вместо обрыва всей серии ошибкой.
  private trainerUnavailableOn(trainer: { departedAt: Date | null; unavailableFrom: Date | null; unavailableUntil: Date | null }, date: Date): 'DEPARTED' | 'UNAVAILABLE' | null {
    if (trainer.departedAt) return 'DEPARTED';
    if (trainer.unavailableFrom && trainer.unavailableUntil) {
      const day = date.toISOString().slice(0, 10);
      const from = trainer.unavailableFrom.toISOString().slice(0, 10);
      const until = trainer.unavailableUntil.toISOString().slice(0, 10);
      if (day >= from && day <= until) return 'UNAVAILABLE';
    }
    return null;
  }

  private async assertTrainerFreeAt(db: Pick<Prisma.TransactionClient, 'personalSlot' | 'groupClass'>, trainerId: string, range: TimeRange, what: string) {
    const [slots, classes] = await Promise.all([
      db.personalSlot.findMany({ where: { trainerId } }),
      db.groupClass.findMany({ where: { trainerId } }),
    ]);
    const slotClash = slots.find((s) => overlaps(range, { date: s.date, start: s.start, end: s.end }));
    if (slotClash) {
      throw new BadRequestException(
        `У тренера в это время уже есть персональный слот ${slotClash.date.toISOString().slice(0, 10)} ${slotClash.start}–${slotClash.end} — возможно, на другой точке сети. ${what} не создан`,
      );
    }
    const classClash = classes.find((c) => overlaps(range, { date: c.date, start: c.start, end: c.end }));
    if (classClash) {
      throw new BadRequestException(
        `У тренера в это время уже идёт «${classClash.type}» ${classClash.date.toISOString().slice(0, 10)} ${classClash.start}–${classClash.end} — возможно, на другой точке сети. ${what} не создан`,
      );
    }
  }

  async createGroupClass(actor: JwtPayload, dto: CreateGroupClassDto) {
    const trainer = await this.trainers.assertTrainerAtGym(dto.trainerId, actor.gymId);
    this.assertTrainerAvailable(trainer, new Date(dto.date));
    // P3.10: захват «проверить → создать» сериализован advisory-lock'ом по
    // тренеру — два параллельных создания (слот+занятие, или два занятия на
    // разных точках сети) выстраиваются в очередь, второй видит занятое
    // время первого, а не пустоту до его коммита. Тот же лок берёт
    // генератор серий и создание слотов — все маршруты одного тренера
    // сериализуются между собой.
    const gc = await this.withTrainerLock(dto.trainerId, async (tx) => {
      await this.assertTrainerFreeAt(tx, dto.trainerId, { date: new Date(dto.date), start: dto.start, end: dto.end }, 'Занятие');
      return tx.groupClass.create({
        data: { gymId: actor.gymId, ...dto, date: new Date(dto.date) },
      });
    });
    await this.activityLog.log(actor, 'Создал групповое занятие', dto.type, `${dto.date} ${dto.start}–${dto.end}, тренер: ${trainer.name}`);
    return gc;
  }

  // P3.10: сериализация операций одного тренера — xact-scoped advisory lock
  // (живёт ровно до конца транзакции, чистить вручную не нужно).
  private withTrainerLock<T>(trainerId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${trainerId}))`;
      return fn(tx);
    });
  }

  // Запись на групповое занятие — с P0.2 идёт через POST /orders
  // (GROUP_CLASS_BOOKING) и применяется только после подтверждения оплаты
  // чеком, см. api/src/orders/orders.service.ts.

  // --- Серии регулярных занятий (P2.12) ---

  async listSeries(actor: JwtPayload) {
    const gymIds = await this.gymIdsForActor(actor);
    return this.prisma.groupClassSeries.findMany({
      where: { gymId: { in: gymIds } },
      include: {
        trainer: { select: { id: true, name: true } },
        // Будущие occurrence серии с числом записей — этого достаточно UI,
        // чтобы показать «сколько занятий впереди» и «у скольких есть
        // записи клиентов» без отдельного запроса.
        occurrences: {
          where: { date: { gte: dayUtc(new Date()) } },
          orderBy: [{ date: 'asc' }, { start: 'asc' }],
          select: { id: true, date: true, start: true, end: true, capacity: true, _count: { select: { bookings: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSeries(actor: JwtPayload, dto: CreateGroupClassSeriesDto) {
    const trainer = await this.trainers.assertTrainerAtGym(dto.trainerId, actor.gymId);
    this.assertTrainerAvailable(trainer, new Date(dto.startDate));
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (endDate && endDate < startDate) throw new BadRequestException('Дата конца серии раньше даты начала');
    const series = await this.prisma.groupClassSeries.create({
      data: {
        gymId: actor.gymId,
        type: dto.type,
        trainerId: dto.trainerId,
        zone: dto.zone,
        start: dto.start,
        end: dto.end,
        capacity: dto.capacity,
        weekdays: dto.weekdays,
        startDate,
        endDate,
        horizonDays: dto.horizonDays ?? 28,
      },
    });
    const generation = await this.generateOccurrences(series);
    await this.activityLog.log(
      actor,
      'Создал серию групповых занятий',
      dto.type,
      `${dto.start}–${dto.end}, дни недели (0=Пн): ${dto.weekdays.join(', ')}; занятий создано: ${generation.created.length}, пропущено: ${generation.skipped.length}`,
    );
    return { series, generation };
  }

  private async findSeriesForActor(actor: JwtPayload, seriesId: string) {
    const gymIds = await this.gymIdsForActor(actor);
    const series = await this.prisma.groupClassSeries.findFirst({ where: { id: seriesId, gymId: { in: gymIds } } });
    if (!series) throw new NotFoundException('Серия не найдена');
    return series;
  }

  // Семантика редактирования серии (P2.12, «что происходит с записями
  // клиентов»): будущие occurrence БЕЗ записей удаляются и пересоздаются
  // по новому шаблону; occurrence с записями не трогаем — клиент купил
  // конкретное занятие, оно остаётся «материализованным» исключением
  // (дальнейшая генерация дату с занятием серии пропускает).
  async updateSeries(actor: JwtPayload, seriesId: string, dto: UpdateGroupClassSeriesDto) {
    const series = await this.findSeriesForActor(actor, seriesId);
    if (series.cancelledAt) throw new BadRequestException('Серия отменена — создайте новую');
    if (dto.trainerId && dto.trainerId !== series.trainerId) {
      await this.trainers.assertTrainerAtGym(dto.trainerId, series.gymId);
    }
    const startDate = dto.startDate ? new Date(dto.startDate) : series.startDate;
    const endDate = dto.endDate === null ? null : dto.endDate ? new Date(dto.endDate) : series.endDate;
    if (endDate && endDate < startDate) throw new BadRequestException('Дата конца серии раньше даты начала');

    const removed = await this.prisma.groupClass.deleteMany({
      where: { seriesId, date: { gte: dayUtc(new Date()) }, bookings: { none: {} } },
    });
    const updated = await this.prisma.groupClassSeries.update({
      where: { id: seriesId },
      data: {
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.trainerId !== undefined ? { trainerId: dto.trainerId } : {}),
        ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
        ...(dto.start !== undefined ? { start: dto.start } : {}),
        ...(dto.end !== undefined ? { end: dto.end } : {}),
        ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
        ...(dto.weekdays !== undefined ? { weekdays: dto.weekdays } : {}),
        ...(dto.startDate !== undefined ? { startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate } : {}),
        ...(dto.horizonDays !== undefined ? { horizonDays: dto.horizonDays } : {}),
      },
    });
    const generation = await this.generateOccurrences(updated);
    await this.activityLog.log(
      actor,
      'Изменил серию групповых занятий',
      updated.type,
      `будущих без записей удалено: ${removed.count}, создано: ${generation.created.length}, пропущено: ${generation.skipped.length}`,
    );
    return { series: updated, removedUnbooked: removed.count, generation };
  }

  // Отмена серии целиком (P2.12): шаблон перестаёт генерировать
  // (cancelledAt), будущие occurrence без записей удаляются молча, с
  // записями — отменяются с уведомлением каждого клиента (возврат денег —
  // отдельный ручной процесс через P0.7, автоматом не запускаем).
  async cancelSeries(actor: JwtPayload, seriesId: string) {
    const series = await this.findSeriesForActor(actor, seriesId);
    if (series.cancelledAt) return { series, removedOccurrences: 0, cancelledWithBookings: 0 };
    const future = await this.prisma.groupClass.findMany({
      where: { seriesId, date: { gte: dayUtc(new Date()) } },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
    let cancelledWithBookings = 0;
    for (const gc of future) {
      const bookings = await this.prisma.groupClassBooking.findMany({ where: { groupClassId: gc.id } });
      if (bookings.length > 0) {
        for (const b of bookings) {
          await this.notifications.notify(
            b.clientId,
            'GROUP_CLASS_CANCELLED',
            'Занятие отменено',
            `«${gc.type}» ${gc.date.toISOString().slice(0, 10)} ${gc.start} отменено вместе со всей серией. Записываться на другие занятия можно в приложении; за возвратом оплаты обратитесь к администратору клуба.`,
            gc.id,
          );
        }
        cancelledWithBookings++;
      }
      await this.prisma.groupClass.delete({ where: { id: gc.id } });
    }
    const updated = await this.prisma.groupClassSeries.update({ where: { id: seriesId }, data: { cancelledAt: new Date() } });
    await this.activityLog.log(
      actor,
      'Отменил серию групповых занятий',
      series.type,
      `будущих занятий удалено: ${future.length}, из них с записями клиентов: ${cancelledWithBookings}`,
    );
    return { series: updated, removedOccurrences: future.length, cancelledWithBookings };
  }

  // Ручная догенерация в пределах горизонта: CEO нажимает после того, как
  // обстоятельства изменились (тренер вернулся из отпуска, освободилось
  // пересекавшееся время) — даты, раньше пропущенные, добираются.
  async regenerateSeries(actor: JwtPayload, seriesId: string) {
    const series = await this.findSeriesForActor(actor, seriesId);
    if (series.cancelledAt) throw new BadRequestException('Серия отменена');
    const generation = await this.generateOccurrences(series);
    await this.activityLog.log(
      actor,
      'Перегенерировал занятия серии',
      series.type,
      `создано: ${generation.created.length}, пропущено: ${generation.skipped.length}`,
    );
    return generation;
  }

  // Ядро генерации (P2.12): для каждого дня недели серии в окне
  // [max(startDate, сегодня), min(сегодня+horizonDays, endDate)] создаёт
  // занятие-occurrence, если его ещё нет. Окно дат — чистая функция
  // seriesWindowDates (P3.1). Даты пропускаются (не отбрасывают серию
  // ошибкой) с указанием причины: тренер недоступен/ушёл (P2.10) или время
  // занято другой активностью (P2.7). Идемпотентно: повторный прогон
  // добирает только недостающие даты.
  private async generateOccurrences(series: { id: string; gymId: string; type: string; trainerId: string; zone: string; start: string; end: string; capacity: number; weekdays: number[]; startDate: Date; endDate: Date | null; horizonDays: number }) {
    const result = { created: [] as string[], skipped: [] as { date: string; reason: string }[] };
    const candidates = seriesWindowDates(series);
    if (candidates.length === 0) return result;

    // P3.10: генерация сериализуется с ручными создателями тем же
    // advisory-lock'ом по тренеру — окно между проверкой коллизий и
    // созданием занятия не может быть «обогнано» параллельным слотом.
    return this.withTrainerLock(series.trainerId, async (tx) => {
      const [trainer, existing, trainerSlots, trainerClasses] = await Promise.all([
        tx.trainer.findUnique({ where: { id: series.trainerId } }),
        tx.groupClass.findMany({ where: { seriesId: series.id }, select: { date: true } }),
        tx.personalSlot.findMany({ where: { trainerId: series.trainerId } }),
        tx.groupClass.findMany({ where: { trainerId: series.trainerId } }),
      ]);
      if (!trainer) return result;

      const existingDays = new Set(existing.map((c) => c.date.toISOString().slice(0, 10)));
      for (const day of candidates) {
        const iso = day.toISOString().slice(0, 10);
        if (existingDays.has(iso)) continue;

        const unavailable = this.trainerUnavailableOn(trainer, day);
        if (unavailable) {
          result.skipped.push({ date: iso, reason: unavailable === 'DEPARTED' ? 'Тренер ушёл' : 'Тренер недоступен (отпуск/болезнь)' });
          continue;
        }
        const range = { date: day, start: series.start, end: series.end };
        const slotClash = trainerSlots.find((s) => overlaps(range, { date: s.date, start: s.start, end: s.end }));
        if (slotClash) {
          result.skipped.push({ date: iso, reason: `Время занято персональным слотом ${slotClash.start}–${slotClash.end}` });
          continue;
        }
        const classClash = trainerClasses.find((c) => overlaps(range, { date: c.date, start: c.start, end: c.end }));
        if (classClash) {
          result.skipped.push({ date: iso, reason: `Пересекается с «${classClash.type}» ${classClash.start}–${classClash.end}` });
          continue;
        }

        await tx.groupClass.create({
          data: {
            gymId: series.gymId,
            seriesId: series.id,
            type: series.type,
            trainerId: series.trainerId,
            zone: series.zone,
            date: day,
            start: series.start,
            end: series.end,
            capacity: series.capacity,
          },
        });
        existingDays.add(iso);
        result.created.push(iso);
      }
      return result;
    });
  }

  // Диспетчер скользящего горизонта (P2.12): без планировщика в проекте —
  // лёгкий интервал в API-процессе (как диспетчер напоминалок P2.4).
  // Запускается сразу при старте (чтобы горизонт заполнился до первого
  // тика) и далее поддерживает все живые серии.
  async topUpAllSeries(): Promise<number> {
    const today = dayUtc(new Date());
    const list = await this.prisma.groupClassSeries.findMany({ where: { cancelledAt: null, OR: [{ endDate: null }, { endDate: { gte: today } }] } });
    let created = 0;
    for (const series of list) {
      const result = await this.generateOccurrences(series);
      created += result.created.length;
    }
    return created;
  }

  onModuleInit() {
    // P3.18: догенерация серий в PM2-кластере — только воркер 0.
    if (!isDispatcherInstance()) return;
    this.topUpAllSeries().catch((err) => this.logger.error(`Стартовая догенерация серий упала: ${(err as Error).message}`));
    this.topUpTimer = setInterval(() => {
      this.topUpAllSeries().catch((err) => this.logger.error(`Тик догенерации серий упал: ${(err as Error).message}`));
    }, SERIES_TOPUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.topUpTimer) clearInterval(this.topUpTimer);
  }

  async cancelGroupClassBooking(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const gc = await this.prisma.groupClass.findUnique({ where: { id: classId } });
    // Групповое занятие не блокируем поздней отменой (P2.5): место всё
    // равно освободится физически и его подберёт лист ожидания (P2.3) —
    // но отмечаем в журнале, поздно ли отменил клиент (для разбора
    // спорных возвратов).
    const late = !!gc && hoursBefore(startsAt(gc.date, gc.start)) < lateCancelWindowHours('GROUP');
    const deleted = await this.prisma.groupClassBooking.deleteMany({ where: { groupClassId: classId, clientId } });
    if (deleted.count > 0) {
      // Место освободилось — первый в листе ожидания получает уведомление
      // (P2.3). Промоут после удаления, а не в транзакции с ним: письмо не
      // должно отправиться, если сама отмена по какой-то причине откатится.
      await this.promoteWaitlist(classId);
    }
    await this.activityLog.log(actor, 'Отменил запись на групповое занятие', clientId, `${classId}${late ? ` (поздняя отмена, менее ${lateCancelWindowHours('GROUP')} ч до начала)` : ''}`);
    return { ok: true };
  }

  // --- Лист ожидания на групповое занятие (P2.3) ---

  async joinWaitlist(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const gymIds = await this.gymIdsForActor(actor);
    const gc = await this.prisma.groupClass.findFirst({
      where: { id: classId, gymId: { in: gymIds } },
      include: { bookings: true, waitlist: true },
    });
    if (!gc) throw new NotFoundException('Занятие не найдено');
    if (gc.date.getTime() < startOfDay(new Date()).getTime()) {
      throw new BadRequestException('Занятие уже прошло — лист ожидания не имеет смысла');
    }
    if (gc.bookings.some((b) => b.clientId === clientId)) {
      throw new BadRequestException('Клиент уже записан на это занятие — лист ожидания не нужен');
    }
    if (gc.bookings.length < gc.capacity) {
      throw new BadRequestException('На занятии есть свободные места — запишитесь обычным способом (через оплату заказа)');
    }
    try {
      const entry = await this.prisma.groupClassWaitlistEntry.create({ data: { groupClassId: gc.id, clientId } });
      const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true } });
      await this.activityLog.log(actor, 'Записал в лист ожидания', client.name, `${gc.type}, ${gc.date.toISOString().slice(0, 10)} ${gc.start} (позиция ${gc.waitlist.length + 1})`);
      return entry;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Клиент уже в листе ожидания на это занятие');
      }
      throw err;
    }
  }

  async leaveWaitlist(actor: JwtPayload, classId: string, explicitClientId?: string) {
    const clientId = await resolveClientId(this.prisma, actor, explicitClientId);
    const deleted = await this.prisma.groupClassWaitlistEntry.deleteMany({ where: { groupClassId: classId, clientId } });
    if (deleted.count === 0) throw new NotFoundException('Запись в листе ожидания не найдена');
    return { ok: true };
  }

  // Место освободилось (отмена записи или возврат по заказу) — уведомляем
  // первого ещё не уведомлённого ждущего. Место НЕ резервируется: запись
  // остаётся обычной покупкой через заказ с чеком (P0.2), уведомление
  // только сообщает, что очередь подошла. Ждущие, которые успели
  // записаться сами (гонка места и очереди), из очереди выбывают молча.
  // Уведомление одно на освобождение — очередь двигается дальше только
  // при следующем освобождении; отказавшиеся выбывают через leaveWaitlist.
  async promoteWaitlist(classId: string) {
    const gc = await this.prisma.groupClass.findUnique({
      where: { id: classId },
      include: {
        bookings: true,
        waitlist: { orderBy: { joinedAt: 'asc' }, include: { client: { select: { name: true, email: true } } } },
      },
    });
    if (!gc || gc.bookings.length >= gc.capacity) return;

    const bookedIds = new Set(gc.bookings.map((b) => b.clientId));
    const stale = gc.waitlist.filter((w) => bookedIds.has(w.clientId));
    if (stale.length > 0) {
      await this.prisma.groupClassWaitlistEntry.deleteMany({ where: { id: { in: stale.map((w) => w.id) } } });
    }
    const next = gc.waitlist.find((w) => !bookedIds.has(w.clientId) && !w.notifiedAt);
    if (!next) return;

    await this.prisma.groupClassWaitlistEntry.update({ where: { id: next.id }, data: { notifiedAt: new Date() } });
    await this.email.send(
      next.client.email,
      'Место освободилось — занятие SiberianGym',
      `Здравствуйте, ${next.client.name}!\n\nМесто освободилось на занятии «${gc.type}» ${gc.date.toISOString().slice(0, 10)} в ${gc.start}.\nМесто не резервируется: запишитесь обычным способом в приложении (Календарь → Записаться). Если вас опередят — вы останетесь в очереди и получите следующее уведомление после отказа.\n\nSiberianGym`,
    );
  }

  // --- Персональные слоты ---

  async listPersonalSlots(actor: JwtPayload) {
    const gymIds = await this.gymIdsForActor(actor);
    return this.prisma.personalSlot.findMany({
      where: { gymId: { in: gymIds } },
      include: { trainer: true, client: true },
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
  }

  async createPersonalSlot(actor: JwtPayload, dto: CreatePersonalSlotDto) {
    const trainer = await this.trainers.assertTrainerAtGym(dto.trainerId, actor.gymId);
    this.assertTrainerAvailable(trainer, new Date(dto.date));
    // P3.10: та же сериализация advisory-lock'ом, что и у занятий.
    return this.withTrainerLock(dto.trainerId, async (tx) => {
      await this.assertTrainerFreeAt(tx, dto.trainerId, { date: new Date(dto.date), start: dto.start, end: dto.end }, 'Слот');
      return tx.personalSlot.create({
        data: { gymId: actor.gymId, trainerId: dto.trainerId, date: new Date(dto.date), start: dto.start, end: dto.end, status: 'FREE' },
      });
    });
  }

  // Запись на персональный слот — с P0.2 идёт через POST /orders
  // (PERSONAL_SLOT_BOOKING) и применяется только после подтверждения оплаты
  // чеком, см. api/src/orders/orders.service.ts.

  async cancelPersonalSlot(actor: JwtPayload, slotId: string) {
    const slot = await this.prisma.personalSlot.findFirst({ where: { id: slotId, gymId: actor.gymId }, include: { trainer: true } });
    if (!slot) throw new NotFoundException('Слот не найден');
    if (actor.role === 'CLIENT') {
      const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
      if (!client || slot.clientId !== client.id) throw new ForbiddenException('Это не ваша запись');
      // Поздняя отмена (P2.5): персональная тренировка платная, и отказ
      // за считанные часы — это потерянное время тренера, которое уже не
      // продать. Клиенту — только через администратора (форс-мажор решает
      // персонал), персонал отменяет без ограничений.
      if (slot.status === 'BOOKED' && hoursBefore(startsAt(slot.date, slot.start)) < lateCancelWindowHours('PERSONAL')) {
        throw new BadRequestException(
          `До тренировки меньше ${lateCancelWindowHours('PERSONAL')} ч — поздняя отмена недоступна в приложении, свяжитесь с администратором клуба`,
        );
      }
    }
    await this.prisma.personalSlot.update({ where: { id: slotId }, data: { status: 'FREE', clientId: null } });
    // Отмена забронированного слота — «критичное» напоминание из P2.4:
    // клиент мог уже планировать день вокруг тренировки, поэтому канал
    // SMS подключается как fallback (в демо логируется). Отмену самим
    // клиентом тоже шлём — подтверждение не помешает.
    if (slot.clientId && slot.status === 'BOOKED') {
      await this.notifications.notify(
        slot.clientId,
        'SLOT_CANCELLED',
        'Персональная тренировка отменена',
        `Слот ${slot.date.toISOString().slice(0, 10)} ${slot.start} у тренера ${slot.trainer.name} освобождён. Запишитесь на другое время.`,
        slot.id,
      );
    }
    return this.prisma.personalSlot.findUniqueOrThrow({ where: { id: slotId } });
  }

  // Тренер/администратор отмечает явку после тренировки.
  async markSlotAttendance(actor: JwtPayload, slotId: string, status: Extract<SlotStatus, 'PAST_COMPLETED' | 'PAST_MISSED'>) {
    const slot = await this.prisma.personalSlot.findFirst({ where: { id: slotId, gymId: actor.gymId } });
    if (!slot) throw new NotFoundException('Слот не найден');
    const updated = await this.prisma.personalSlot.update({ where: { id: slotId }, data: { status } });
    await this.activityLog.log(actor, 'Отметил явку на тренировку', slotId, status === 'PAST_COMPLETED' ? 'Пришёл' : 'Не пришёл');
    return updated;
  }
}
