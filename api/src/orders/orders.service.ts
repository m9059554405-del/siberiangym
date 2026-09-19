import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MembershipScope, MembershipType, OrderLineType, Prisma, Tariff, TransactionCategory } from '@prisma/client';
import type { Client, Order, OrderLine } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AcquiringService } from '../acquiring/acquiring.service';
import { CreateOrderDto, OrderLineInputDto } from './dto/create-order.dto';
import { formatForTariff, MEMBERSHIP_LABEL, VALIDITY_DAYS, VISITS_TOTAL } from '../clients/membership.const';
import { ESCORT_PRICE_COLUMN, ESCORT_TARIFFS, TARIFF_NAME } from '../clients/tariffs.const';
import { isMinor as computeIsMinor } from '../clients/age.util';
import { amountsMatchToKopeck, parseFiscalReceiptQr } from './receipt-qr.util';
import { overlaps, type TimeRange } from '../schedule/time-overlap.util';
import { isDispatcherInstance } from '../common/dispatcher';
import type { JwtPayload } from '../auth/auth.service';

const AWAITING_PAYMENT_TIMEOUT_MINUTES = Number(process.env.ORDER_AWAITING_PAYMENT_TIMEOUT_MINUTES ?? 120);
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const CATEGORY_BY_LINE_TYPE: Record<OrderLineType, TransactionCategory> = {
  MEMBERSHIP_PURCHASE: 'MEMBERSHIP',
  MEMBERSHIP_RENEWAL: 'MEMBERSHIP',
  TARIFF_CHANGE: 'PERSONAL',
  STOCK_PURCHASE: 'ANCILLARY',
  LOCKER_RENTAL: 'ANCILLARY',
  GROUP_CLASS_BOOKING: 'GROUP',
  PERSONAL_SLOT_BOOKING: 'PERSONAL',
};

interface QuotedLine {
  type: OrderLineType;
  refId: string | null;
  amount: number;
  meta: Record<string, unknown> | null;
}

// Заказ (Order) — промежуточная сущность между "клиент/администратор
// захотел что-то купить" и "деньги реально приняты". Ничего из перечисленного
// в заказе (продление абонемента, бронирование слота, аренда шкафчика и т.д.)
// не применяется, пока администратор не отсканирует реальный кассовый чек и
// его сумма не совпадёт с суммой заказа — см. P0.2 в бэклоге.
@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private sweepTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly email: EmailService,
    private readonly notifications: NotificationsService,
    private readonly acquiring: AcquiringService,
  ) {}

  // Просрочка "брошенных" заказов — периодический сдвиг статуса без внешнего
  // планировщика (в проекте пока нет @nestjs/schedule/BullMQ, см. P3-техдолг);
  // интервал внутри процесса — сознательно простое решение для одного
  // инстанса API, при переходе на кластер (P3.18) стоит заменить на
  // распределённый планировщик, чтобы не гонять просрочку в N копиях сразу.
  onModuleInit() {
    // P3.18: просрочкой заказов в PM2-кластере занимается только воркер 0.
    if (!isDispatcherInstance()) return;
    this.sweepTimer = setInterval(() => {
      this.expireStale().catch((err) => this.logger.error('Не удалось выполнить просрочку заказов', err));
    }, SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  private async getOwnedOrder(actor: JwtPayload, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, gymId: actor.gymId },
      include: { lines: true, client: true },
    });
    if (!order) throw new NotFoundException('Заказ не найден');
    // Видимость и право завершить заказ — по точке (gymId), а не по создавшему
    // его администратору: смена на ресепшене могла смениться, пока заказ ждал
    // подтверждения. Единственное исключение — сам клиент видит только свои заказы.
    if (actor.role === 'CLIENT' && order.client.userId !== actor.sub) {
      throw new ForbiddenException('Недостаточно прав для этого заказа');
    }
    return order;
  }

  // Оформление абонемента/тарифа несовершеннолетнему требует хотя бы
  // одного законного представителя с подписанными согласиями (152-ФЗ на
  // ПДн несовершеннолетнего + информированное согласие на занятия) —
  // блокируется на уровне сервиса, до того как заказ/транзакция вообще
  // создастся (P0.6), а не оставлено на усмотрение администратора.
  // P0.6 (хвост): запись на сами занятия (групповые/персональные) тоже
  // проверяется — для них достаточно ACTIVITY_WAIVER_MINOR_GUARDIAN
  // (допуск к занятиям): ПДн-согласие Representative подписал при
  // оформлении карточки/абонемента, повторно требовать его нет смысла.
  private async assertGuardianConsentsIfMinor(
    gymId: string,
    clientId: string,
    requiredTypes: ('PDN_MINOR_GUARDIAN' | 'ACTIVITY_WAIVER_MINOR_GUARDIAN')[] = ['PDN_MINOR_GUARDIAN', 'ACTIVITY_WAIVER_MINOR_GUARDIAN'],
  ): Promise<void> {
    const [client, gym] = await Promise.all([
      // Чтение строго в рамках своей точки (P1.6): раньше birthday читался
      // по голому id, и поведение проверки выдавало оракулом существование
      // и возраст чужого для этой точки клиента.
      this.prisma.client.findFirst({ where: { id: clientId, gymId }, select: { birthday: true } }),
      this.prisma.gym.findUniqueOrThrow({ where: { id: gymId }, select: { selfTrainingMinAge: true } }),
    ]);
    if (!client) throw new NotFoundException('Клиент не найден');
    if (!computeIsMinor(client.birthday, gym.selfTrainingMinAge)) return;

    const guardianLinks = await this.prisma.guardianChild.findMany({ where: { clientId }, select: { guardianId: true } });
    if (guardianLinks.length === 0) {
      throw new BadRequestException('У несовершеннолетнего клиента нет законного представителя — сначала добавьте его в карточке клиента');
    }

    const consents = await this.prisma.consentRecord.findMany({
      where: {
        clientId,
        guardianId: { in: guardianLinks.map((l) => l.guardianId) },
        type: { in: requiredTypes },
      },
      orderBy: { createdAt: 'desc' },
    });
    const latestByType = new Map<string, boolean>();
    for (const c of consents) {
      if (!latestByType.has(c.type)) latestByType.set(c.type, c.granted);
    }
    if (requiredTypes.some((t) => latestByType.get(t) !== true)) {
      throw new BadRequestException(
        'Оформление несовершеннолетнему требует подписанных согласий законного представителя (152-ФЗ и допуск к занятиям) — зафиксируйте их в карточке клиента',
      );
    }
  }

  // P2.7: защита от двойного бронирования — у клиента не может быть двух
  // оплаченных активностей (персональная тренировка или групповое занятие),
  // пересекающихся по времени. Проверяется и при сборке заказа (быстрая
  // обратная связь), и повторно в транзакции подтверждения чека. Слоты с
  // завершившимся статусом (PAST_*) тоже считаются занятым временем —
  // неявка не освобождает интервал для повторной продажи «в прошлое».
  // Известное окно: два заказа одного клиента подтверждаются одновременно —
  // каждая транзакция блокирует свою строку ресурса и не видит незакоммиченную
  // соседнюю; окно в секунды, полная гарантия потребовала бы глобальной
  // блокировки клиента на каждую запись, что несоразмерно проблеме.
  private async assertClientFreeAt(
    db: Pick<Prisma.TransactionClient, 'personalSlot' | 'groupClassBooking'>,
    clientId: string,
    range: TimeRange,
    target: string,
  ): Promise<void> {
    const [slots, groupBookings] = await Promise.all([
      db.personalSlot.findMany({
        where: { clientId, status: { in: ['BOOKED', 'PAST_COMPLETED', 'PAST_MISSED'] } },
        include: { trainer: { select: { name: true } } },
      }),
      db.groupClassBooking.findMany({ where: { clientId }, include: { groupClass: { include: { trainer: { select: { name: true } } } } } }),
    ]);
    const slotClash = slots.find((s) => overlaps(range, { date: s.date, start: s.start, end: s.end }));
    if (slotClash) {
      throw new ConflictException(
        `Двойное бронирование: у клиента уже есть персональная тренировка ${slotClash.date.toISOString().slice(0, 10)} ${slotClash.start}–${slotClash.end} (${slotClash.trainer.name}), она пересекается с ${target}`,
      );
    }
    const groupClash = groupBookings.find((b) => overlaps(range, { date: b.groupClass.date, start: b.groupClass.start, end: b.groupClass.end }));
    if (groupClash) {
      const gc = groupClash.groupClass;
      throw new ConflictException(
        `Двойное бронирование: клиент уже записан на «${gc.type}» ${gc.date.toISOString().slice(0, 10)} ${gc.start}–${gc.end} (${gc.trainer.name}), это пересекается с ${target}`,
      );
    }
  }

  private async quoteLine(gymId: string, clientId: string, input: OrderLineInputDto): Promise<QuotedLine> {
    const meta = (input.meta ?? {}) as Record<string, unknown>;

    switch (input.type) {
      case OrderLineType.MEMBERSHIP_PURCHASE: {
        const membershipType = meta.membershipType as MembershipType;
        if (!membershipType || !(membershipType in VALIDITY_DAYS)) {
          throw new BadRequestException('Не указан или некорректен тип абонемента');
        }
        // Область действия (P1.2) — "своя точка" по умолчанию, для
        // обратной совместимости со всеми вызовами до появления сети.
        const scope = ((meta.scope as MembershipScope | undefined) ?? 'SINGLE_GYM') as MembershipScope;
        if (scope !== 'SINGLE_GYM' && scope !== 'NETWORK') {
          throw new BadRequestException('Некорректная область действия абонемента');
        }
        await this.assertGuardianConsentsIfMinor(gymId, clientId);
        const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId } });
        const priceMap: Record<MembershipType, number | undefined> =
          scope === 'NETWORK'
            ? { SINGLE: pricing?.singleNetwork ?? undefined, MONTHLY: pricing?.monthlyNetwork ?? undefined, PACK10: pricing?.pack10Network ?? undefined, PACK20: pricing?.pack20Network ?? undefined }
            : { SINGLE: pricing?.single, MONTHLY: pricing?.monthly, PACK10: pricing?.pack10, PACK20: pricing?.pack20 };
        const price = priceMap[membershipType];
        if (scope === 'NETWORK' && price == null) {
          throw new BadRequestException('На этой точке не настроена цена абонемента на всю сеть для этого типа — обратитесь к CEO');
        }
        const membership = await this.prisma.membership.findUnique({ where: { clientId } });
        const isRenewal = !!membership;
        return {
          type: isRenewal ? OrderLineType.MEMBERSHIP_RENEWAL : OrderLineType.MEMBERSHIP_PURCHASE,
          refId: null,
          amount: price ?? 0,
          meta: { membershipType, scope },
        };
      }

      case OrderLineType.TARIFF_CHANGE: {
        const tariff = meta.tariff as Tariff;
        if (!tariff || !ESCORT_TARIFFS.includes(tariff)) throw new BadRequestException('Не указан или некорректен тариф');
        await this.assertGuardianConsentsIfMinor(gymId, clientId);
        const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId } });
        if (!client) throw new NotFoundException('Клиент не найден');
        const trainerId = (meta.trainerId as string | undefined) ?? input.refId ?? client.trainerId ?? undefined;
        if (!trainerId) throw new BadRequestException('Не указан тренер — сначала выберите тренера');
        const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, gymId } });
        if (!trainer) throw new NotFoundException('Тренер не найден');
        // Цена тарифа — настройка точки (P4.2), не константа кода.
        const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId } });
        if (!pricing) throw new BadRequestException('Цены зала ещё не настроены — обратитесь к владельцу');
        return {
          type: OrderLineType.TARIFF_CHANGE,
          refId: trainerId,
          amount: pricing[ESCORT_PRICE_COLUMN[tariff]],
          meta: { tariff, trainerId },
        };
      }

      case OrderLineType.STOCK_PURCHASE: {
        if (!input.refId) throw new BadRequestException('Не указан товар');
        const item = await this.prisma.catalogItem.findFirst({ where: { id: input.refId, gymId } });
        if (!item) throw new NotFoundException('Товар не найден');
        return { type: OrderLineType.STOCK_PURCHASE, refId: item.id, amount: item.price, meta: null };
      }

      case OrderLineType.LOCKER_RENTAL: {
        if (!input.refId) throw new BadRequestException('Не указан шкафчик');
        const days = Number(meta.days);
        if (!Number.isInteger(days) || days < 1) throw new BadRequestException('Некорректное число дней аренды');
        const locker = await this.prisma.locker.findFirst({ where: { id: input.refId, gymId } });
        if (!locker) throw new NotFoundException('Шкафчик не найден');
        if (locker.status !== 'FREE') throw new BadRequestException('Шкафчик уже занят');
        return { type: OrderLineType.LOCKER_RENTAL, refId: locker.id, amount: locker.pricePerDay * days, meta: { days } };
      }

      case OrderLineType.GROUP_CLASS_BOOKING: {
        if (!input.refId) throw new BadRequestException('Не указано групповое занятие');
        // P0.6: несовершеннолетний тренируется только с допуском законного
        // представителя — проверка до чтения занятия, дешевле и раньше.
        await this.assertGuardianConsentsIfMinor(gymId, clientId, ['ACTIVITY_WAIVER_MINOR_GUARDIAN']);
        const gc = await this.prisma.groupClass.findFirst({ where: { id: input.refId, gymId }, include: { bookings: true } });
        if (!gc) throw new NotFoundException('Занятие не найдено');
        if (gc.bookings.some((b) => b.clientId === clientId)) throw new BadRequestException('Клиент уже записан на это занятие');
        if (gc.bookings.length >= gc.capacity) throw new BadRequestException('Мест не осталось');
        // P2.7: preflight двойного бронирования — финальная проверка
        // повторяется в транзакции подтверждения чека.
        await this.assertClientFreeAt(this.prisma, clientId, { date: gc.date, start: gc.start, end: gc.end }, 'выбранным занятием');
        const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId } });
        return { type: OrderLineType.GROUP_CLASS_BOOKING, refId: gc.id, amount: pricing?.groupSingle ?? 0, meta: { trainerId: gc.trainerId } };
      }

      case OrderLineType.PERSONAL_SLOT_BOOKING: {
        if (!input.refId) throw new BadRequestException('Не указан персональный слот');
        // P0.6: тот же допуск законного представителя, что и у групповых.
        await this.assertGuardianConsentsIfMinor(gymId, clientId, ['ACTIVITY_WAIVER_MINOR_GUARDIAN']);
        const slot = await this.prisma.personalSlot.findFirst({ where: { id: input.refId, gymId }, include: { trainer: true } });
        if (!slot) throw new NotFoundException('Слот не найден');
        if (slot.status !== 'FREE') throw new BadRequestException('Слот уже занят');
        // P2.7: preflight двойного бронирования — финальная проверка
        // повторяется в транзакции подтверждения чека.
        await this.assertClientFreeAt(this.prisma, clientId, { date: slot.date, start: slot.start, end: slot.end }, 'выбранным слотом');
        return { type: OrderLineType.PERSONAL_SLOT_BOOKING, refId: slot.id, amount: slot.trainer.personalSessionPrice, meta: { trainerId: slot.trainerId } };
      }

      default:
        throw new BadRequestException(`Неизвестный тип позиции заказа: ${input.type as string}`);
    }
  }

  async createOrder(actor: JwtPayload, dto: CreateOrderDto) {
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    if (actor.role === 'CLIENT' && client.userId !== actor.sub) {
      throw new ForbiddenException('Можно оформлять заказ только на себя');
    }
    if (!dto.lines || dto.lines.length === 0) throw new BadRequestException('В заказе должна быть хотя бы одна позиция');

    const quoted: QuotedLine[] = [];
    for (const line of dto.lines) {
      quoted.push(await this.quoteLine(actor.gymId, dto.clientId, line));
    }
    const totalAmount = quoted.reduce((sum, l) => sum + l.amount, 0);

    return this.prisma.order.create({
      data: {
        gymId: actor.gymId,
        clientId: dto.clientId,
        createdBy: actor.sub,
        status: 'DRAFT',
        totalAmount,
        lines: {
          create: quoted.map((l) => ({
            type: l.type,
            refId: l.refId,
            amount: l.amount,
            meta: l.meta === null ? Prisma.JsonNull : (l.meta as Prisma.InputJsonValue),
          })),
        },
      },
      include: { lines: true },
    });
  }

  async submitCash(actor: JwtPayload, orderId: string) {
    const order = await this.getOwnedOrder(actor, orderId);
    if (order.status !== 'DRAFT') throw new BadRequestException('Заказ уже отправлен на оплату или закрыт');
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'AWAITING_PAYMENT',
        paymentMethod: 'CASH',
        expiresAt: new Date(Date.now() + AWAITING_PAYMENT_TIMEOUT_MINUTES * 60_000),
      },
      include: { lines: true },
    });
    await this.activityLog.log(actor, 'Отправил заказ на оплату наличными', order.client.name, `${order.lines.length} поз. на ${order.totalAmount} ₽`);
    return updated;
  }

  // P2.9: самостоятельная оплата картой из приложения. Заказ уходит в
  // AWAITING_PAYMENT с методом CARD_ONLINE и платёжной ссылкой гейта;
  // оплату подтверждает вебхук банка (payments.service), а не скан чека
  // администратором — фискальный чек по 54-ФЗ выдаёт онлайн-касса
  // платёжного шлюза.
  async submitOnline(actor: JwtPayload, orderId: string) {
    if (!this.acquiring.isConfigured()) {
      throw new BadRequestException('Онлайн-оплата картой не настроена — оплатите через администратора клуба');
    }
    const order = await this.getOwnedOrder(actor, orderId);
    if (order.status !== 'DRAFT') throw new BadRequestException('Заказ уже отправлен на оплату или закрыт');
    const { paymentUrl } = this.acquiring.createPayment({ id: order.id, totalAmount: order.totalAmount });
    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'AWAITING_PAYMENT',
        paymentMethod: 'CARD_ONLINE',
        expiresAt: new Date(Date.now() + AWAITING_PAYMENT_TIMEOUT_MINUTES * 60_000),
      },
      include: { lines: true },
    });
    await this.activityLog.log(actor, 'Отправил заказ на онлайн-оплату картой', order.client.name, `${order.lines.length} поз. на ${order.totalAmount} ₽`);
    return { ...updated, paymentUrl };
  }

  // Применяет ОДНУ позицию заказа — только мутация состояния, без создания
  // Transaction (это делает вызывающий код в confirmReceipt внутри общей
  // транзакции БД, вместе для всех позиций разом). Повторно проверяет, что
  // ограниченный ресурс (шкафчик/слот/место в группе) всё ещё свободен —
  // окно между сборкой заказа и подтверждением чека ничем не заблокировано.
  // Захват слота/места в группе с P2.7 сериализуется блокировкой строки
  // ресурса (FOR UPDATE); шкафчики остаются check-then-act (P3.10).
  private async applyLine(
    tx: Prisma.TransactionClient,
    clientId: string,
    line: { type: OrderLineType; refId: string | null; amount: number; meta: Prisma.JsonValue },
  ): Promise<{
    description: string;
    trainerId: string | null;
    membership?: { type: MembershipType; expiresAt: Date | null };
    prevState?: Record<string, unknown>;
    // Уведомление клиенту по этой позиции (P2.4) — отправляется вызывающим
    // кодом ПОСЛЕ коммита транзакции, чтобы не подтверждать незакоммиченное.
    notify?: { kind: string; title: string; body: string; refId?: string | null };
  }> {
    const meta = (line.meta ?? {}) as Record<string, any>;

    switch (line.type) {
      case 'MEMBERSHIP_PURCHASE':
      case 'MEMBERSHIP_RENEWAL': {
        const membershipType = meta.membershipType as MembershipType;
        const scope = ((meta.scope as MembershipScope | undefined) ?? 'SINGLE_GYM') as MembershipScope;
        const validityDays = VALIDITY_DAYS[membershipType];
        const expiresAt = validityDays ? new Date(Date.now() + validityDays * 86400000) : null;
        const visitsTotal = VISITS_TOTAL[membershipType];
        // Membership — не история, а один актуальный ряд, перезаписываемый
        // при каждой покупке (см. комментарий у модели). Снимок состояния
        // ДО этой перезаписи сохраняем в OrderLine.meta._prevState — без
        // него P0.7 (возврат) не сможет откатить продление обратно.
        const before = await tx.membership.findUnique({ where: { clientId } });
        const prevState = before
          ? {
              hadMembership: true,
              type: before.type,
              scope: before.scope,
              purchasedAt: before.purchasedAt.toISOString(),
              expiresAt: before.expiresAt?.toISOString() ?? null,
              visitsTotal: before.visitsTotal,
              visitsLeft: before.visitsLeft,
              status: before.status,
              frozenDaysUsed: before.frozenDaysUsed,
              freezeEndsAt: before.freezeEndsAt?.toISOString() ?? null,
            }
          : { hadMembership: false };
        // Новый оплаченный период: бюджет заморозки (P2.1) начинается
        // заново, незакрытая заморозка старого периода не переносится.
        await tx.membership.upsert({
          where: { clientId },
          create: { clientId, type: membershipType, scope, purchasedAt: new Date(), expiresAt, visitsTotal, visitsLeft: visitsTotal, status: 'ACTIVE', frozenDaysUsed: 0, freezeEndsAt: null },
          update: { type: membershipType, scope, purchasedAt: new Date(), expiresAt, visitsTotal, visitsLeft: visitsTotal, status: 'ACTIVE', frozenDaysUsed: 0, freezeEndsAt: null },
        });
        return {
          description: `${MEMBERSHIP_LABEL[membershipType]}${scope === 'NETWORK' ? ' (вся сеть)' : ''}${expiresAt ? ` до ${expiresAt.toISOString().slice(0, 10)}` : ''}`,
          trainerId: null,
          membership: { type: membershipType, expiresAt },
          prevState,
        };
      }

      case 'TARIFF_CHANGE': {
        const tariff = meta.tariff as Tariff;
        const trainerId = meta.trainerId as string;
        const client = await tx.client.findUniqueOrThrow({ where: { id: clientId } });
        const trainer = await tx.trainer.findUniqueOrThrow({ where: { id: trainerId } });
        const format = formatForTariff(tariff);
        const today = new Date();
        const prevState = { trainerId: client.trainerId, tariff: client.tariff, format: client.format };
        if (client.trainerId !== trainerId || format !== client.format) {
          await tx.clientFormatHistoryEntry.updateMany({ where: { clientId, to: null }, data: { to: today } });
          await tx.clientFormatHistoryEntry.create({ data: { clientId, trainerId, format, from: today, to: null } });
        }
        await tx.client.update({ where: { id: clientId }, data: { trainerId, tariff, format } });
        return { description: `Тариф «${TARIFF_NAME[tariff]}» — ${trainer.name}`, trainerId, prevState };
      }

      case 'STOCK_PURCHASE': {
        const item = await tx.catalogItem.findUniqueOrThrow({ where: { id: line.refId! } });
        return { description: item.name, trainerId: null };
      }

      case 'LOCKER_RENTAL': {
        // P3.10: сериализуем захват строкой FOR UPDATE — параллельные
        // подтверждения ручной аренды не займут шкафчик дважды.
        await tx.$queryRaw`SELECT id FROM lockers WHERE id = ${line.refId!} FOR UPDATE`;
        const days = Number(meta.days);
        const locker = await tx.locker.findUniqueOrThrow({ where: { id: line.refId! } });
        if (locker.status !== 'FREE') {
          throw new ConflictException(`Шкафчик №${locker.number} больше не свободен — кто-то занял его, пока заказ ожидал оплаты`);
        }
        const rentedUntil = new Date(Date.now() + days * 86400000);
        await tx.locker.update({ where: { id: locker.id }, data: { status: 'RENTED', rentedBy: clientId, rentedUntil } });
        return { description: `Аренда кабинки №${locker.number} (${days} дн.)`, trainerId: null };
      }

      case 'GROUP_CLASS_BOOKING': {
        // P2.7/P3.10: блокируем строку занятия до конца транзакции —
        // параллельные подтверждения заказов на то же занятие выстроятся
        // в очередь и второй увидит уже актуальное число записей.
        await tx.$queryRaw`SELECT id FROM group_classes WHERE id = ${line.refId!} FOR UPDATE`;
        const gc = await tx.groupClass.findUniqueOrThrow({ where: { id: line.refId! }, include: { bookings: true } });
        if (gc.bookings.some((b) => b.clientId === clientId)) throw new ConflictException('Клиент уже записан на это занятие');
        if (gc.bookings.length >= gc.capacity) {
          throw new ConflictException('Мест на занятии больше не осталось — кто-то занял их, пока заказ ожидал оплаты');
        }
        await this.assertClientFreeAt(tx, clientId, { date: gc.date, start: gc.start, end: gc.end }, 'оплачиваемым занятием');
        await tx.groupClassBooking.create({ data: { groupClassId: gc.id, clientId } });
        return {
          description: `Запись на групповую тренировку — ${gc.type}`,
          trainerId: gc.trainerId,
          notify: {
            kind: 'BOOKING_CREATED',
            title: 'Вы записаны на групповое занятие',
            body: `«${gc.type}» ${gc.date.toISOString().slice(0, 10)} в ${gc.start}, зона ${gc.zone}. Напомним за час до начала.`,
            refId: gc.id,
          },
        };
      }

      case 'PERSONAL_SLOT_BOOKING': {
        // P2.7/P3.10: блокируем строку слота до конца транзакции —
        // параллельные подтверждения не смогут молча перезаписать чужую
        // бронь (раньше оба читали FREE и второй затирал первого).
        await tx.$queryRaw`SELECT id FROM personal_slots WHERE id = ${line.refId!} FOR UPDATE`;
        const slot = await tx.personalSlot.findUniqueOrThrow({ where: { id: line.refId! }, include: { trainer: true } });
        if (slot.status !== 'FREE') {
          throw new ConflictException('Слот больше не свободен — кто-то занял его, пока заказ ожидал оплаты');
        }
        await this.assertClientFreeAt(tx, clientId, { date: slot.date, start: slot.start, end: slot.end }, 'оплачиваемой тренировкой');
        await tx.personalSlot.update({ where: { id: slot.id }, data: { status: 'BOOKED', clientId } });
        return {
          description: `Персональная тренировка — ${slot.trainer.name}`,
          trainerId: slot.trainerId,
          notify: {
            kind: 'BOOKING_CREATED',
            title: 'Вы записаны на персональную тренировку',
            body: `Слот ${slot.date.toISOString().slice(0, 10)} в ${slot.start}, тренер ${slot.trainer.name}. Напомним за час до начала.`,
            refId: slot.id,
          },
        };
      }

      default:
        throw new BadRequestException(`Неизвестный тип позиции заказа: ${line.type as string}`);
    }
  }

  async confirmReceipt(actor: JwtPayload, orderId: string, qrRaw: string) {
    const order = await this.getOwnedOrder(actor, orderId);
    if (order.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException(order.status === 'PAID' ? 'Заказ уже оплачен' : 'Заказ не ожидает оплаты — сначала отправьте его на оплату наличными');
    }
    // P2.9: онлайн-заказ закрывается вебхуком банка — скан бумажного чека
    // кассира по нему означал бы двойное подтверждение одной оплаты.
    if (order.paymentMethod === 'CARD_ONLINE') {
      throw new BadRequestException('Заказ отправлен на онлайн-оплату картой — он закроется автоматически подтверждением банка');
    }
    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
      await this.markExpired(order.id);
      throw new BadRequestException('Время ожидания оплаты по этому заказу истекло, заказ отменён — соберите заказ заново');
    }

    const receipt = parseFiscalReceiptQr(qrRaw);

    // Один чек — один заказ: уникальный индекс на fn+i+fp защищает от подмены
    // на уровне БД, но проверяем явно заранее, чтобы дать администратору
    // понятное сообщение вместо голой ошибки уникальности индекса.
    const existing = await this.prisma.order.findUnique({
      where: { receiptFn_receiptI_receiptFp: { receiptFn: receipt.fn, receiptI: receipt.i, receiptFp: receipt.fp } },
    });
    if (existing && existing.id !== order.id) {
      await this.activityLog.log(
        actor,
        'Подозрение: повторное использование чека',
        order.client.name,
        `Чек fn=${receipt.fn} i=${receipt.i} fp=${receipt.fp} уже привязан к заказу ${existing.id}, попытка привязать к заказу ${order.id}`,
      );
      throw new ConflictException('Этот чек уже был использован для другого заказа');
    }

    if (!amountsMatchToKopeck(order.totalAmount, receipt.amountRub)) {
      throw new BadRequestException(
        `Сумма чека не совпадает с суммой заказа: в чеке ${receipt.amountRub.toFixed(2)} ₽, в заказе ${order.totalAmount} ₽. Заказ остаётся открытым — отсканируйте корректный чек или отмените заказ.`,
      );
    }

    return this.commitAsPaid(
      order,
      { raw: receipt.raw, date: receipt.date, fn: receipt.fn, i: receipt.i, fp: receipt.fp },
      actor,
      'Подтвердил оплату заказа чеком',
      `${order.lines.length} поз. на ${order.totalAmount} ₽, чек fn=${receipt.fn}`,
    );
  }

  // Тестовая проводка (CEO и администратор): закрывает заказ тем же путём,
  // что и реальная оплата — позиции применяются, транзакции/уведомления
  // создаются, статус уходит в PAID. Отличие от чека/вебхука: фискальных
  // реквизитов нет, receiptRaw помечен как тестовый, чтобы такой заказ
  // можно было отличить от реально оплаченного (для проверки без кассы).
  async testComplete(actor: JwtPayload, orderId: string) {
    if (actor.role !== 'CEO' && actor.role !== 'STAFF') throw new ForbiddenException('Тестовая проводка доступна только CEO и администратору');
    const order = await this.getOwnedOrder(actor, orderId);
    if (order.status !== 'DRAFT' && order.status !== 'AWAITING_PAYMENT') {
      throw new BadRequestException(order.status === 'PAID' ? 'Заказ уже оплачен' : 'Заказ уже закрыт');
    }
    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
      await this.markExpired(order.id);
      throw new BadRequestException('Время ожидания оплаты истекло, заказ отменён — соберите заказ заново');
    }
    // commitAsPaid закрывает только AWAITING_PAYMENT — черновик сначала
    // переводится в ожидание оплаты (как при "Оплатить наличными"), чтобы
    // весь дальнейший путь совпадал с реальной оплатой.
    if (order.status === 'DRAFT') {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'AWAITING_PAYMENT', paymentMethod: 'CASH', expiresAt: new Date(Date.now() + AWAITING_PAYMENT_TIMEOUT_MINUTES * 60_000) },
      });
    }
    const now = new Date();
    return this.commitAsPaid(
      order,
      { raw: `TEST:${now.toISOString()}`, date: now, fn: null, i: null, fp: null },
      actor,
      'Тестовая проводка заказа (без реальной оплаты)',
      `${order.lines.length} поз. на ${order.totalAmount} ₽ — чек не сканировался, проводка тестовая`,
    );
  }

  // Общий финал оплаты (P2.9): применяет позиции, создаёт транзакции,
  // закрывает заказ в PAID. Вызывается из подтверждения чека и из вебхука
  // эквайринга. Строка заказа блокируется FOR UPDATE, статус перепроверяется
  // под блокировкой — вебхук и касса не смогут закрыть заказ дважды.
  private async commitAsPaid(
    order: Order & { lines: OrderLine[]; client: Client },
    receipt: { raw: string; date: Date; fn: string | null; i: string | null; fp: string | null },
    actor: JwtPayload,
    action: string,
    details: string,
  ) {
    let confirmedMembership: { type: MembershipType; expiresAt: Date | null } | undefined;
    const pendingNotifications: Array<{ kind: string; title: string; body: string; refId?: string | null }> = [];
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${order.id} FOR UPDATE`;
      const fresh = await tx.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
      if (fresh.status !== 'AWAITING_PAYMENT') {
        throw new ConflictException('Заказ уже закрыт параллельной оплатой');
      }
      const paidAt = new Date();
      for (const line of order.lines) {
        const applied = await this.applyLine(tx, order.clientId, line);
        if (applied.membership) confirmedMembership = applied.membership;
        if (applied.notify) pendingNotifications.push(applied.notify);
        if (applied.prevState) {
          // Снимок состояния до применения — нужен только для отката при
          // возврате (P0.7), в саму логику применения не участвует.
          const existingMeta = (line.meta ?? {}) as Record<string, unknown>;
          await tx.orderLine.update({
            where: { id: line.id },
            data: { meta: { ...existingMeta, _prevState: applied.prevState } as Prisma.InputJsonValue },
          });
        }
        await tx.transaction.create({
          data: {
            gymId: order.gymId,
            amount: line.amount,
            category: CATEGORY_BY_LINE_TYPE[line.type],
            clientId: order.clientId,
            trainerId: applied.trainerId,
            description: applied.description,
            orderId: order.id,
          },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paidAt,
          receiptRaw: receipt.raw,
          receiptDate: receipt.date,
          receiptFn: receipt.fn,
          receiptI: receipt.i,
          receiptFp: receipt.fp,
        },
      });
    });

    await this.activityLog.log(actor, action, order.client.name, details);

    // Подтверждения записи (P2.4) — после коммита, рядом с письмом об
    // абонементе: та же причина — не подтверждать незакоммиченное.
    for (const n of pendingNotifications) {
      await this.notifications.notify(order.clientId, n.kind, n.title, n.body, n.refId);
    }

    // Письмо шлём уже после успешного коммита транзакции — сбой почты не
    // должен откатывать оплату, а незакоммиченной оплаты письмо подтверждать не должно.
    if (confirmedMembership && order.client.email) {
      const label = MEMBERSHIP_LABEL[confirmedMembership.type];
      const until = confirmedMembership.expiresAt ? `, действует до ${confirmedMembership.expiresAt.toISOString().slice(0, 10)}` : '';
      await this.email.send(
        order.client.email,
        'Абонемент оформлен — SiberianGym',
        `Здравствуйте, ${order.client.name}!\n\nВаш абонемент оформлен: ${label}${until}.\n\nДо встречи в клубе!`,
      );
    }

    return this.prisma.order.findUnique({ where: { id: order.id }, include: { lines: true } });
  }

  // Успех онлайн-оплаты от вебхука эквайринга (P2.9): тот же финал, что и
  // у чека, но без реквизитов бумажного чека — фискальный документ по
  // 54-ФЗ выдаёт онлайн-касса платёжного шлюза. Идемпотентно: повторный
  // вебхук по уже оплаченному заказу — ok без повторного применения.
  async confirmOnlinePayment(orderId: string, amountRub: number, rawPayload: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { lines: true, client: true } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status === 'PAID') return { alreadyPaid: true, order };
    if (order.status !== 'AWAITING_PAYMENT' || order.paymentMethod !== 'CARD_ONLINE') {
      throw new BadRequestException('Заказ не ожидает онлайн-оплаты');
    }
    if (order.expiresAt && order.expiresAt.getTime() < Date.now()) {
      await this.markExpired(order.id);
      throw new BadRequestException('Время ожидания онлайн-оплаты истекло, заказ отменён — оформите новый');
    }
    if (!amountsMatchToKopeck(order.totalAmount, amountRub)) {
      throw new BadRequestException(`Сумма платежа не совпадает с заказом: платёж ${amountRub.toFixed(2)} ₽, заказ ${order.totalAmount} ₽`);
    }
    const webhookActor: JwtPayload = { sub: 'acquiring-webhook', role: 'CEO', gymId: order.gymId };
    const updated = await this.commitAsPaid(
      order,
      { raw: rawPayload, date: new Date(), fn: null, i: null, fp: null },
      webhookActor,
      'Онлайн-оплата подтверждена (вебхук эквайринга)',
      `${order.lines.length} поз. на ${order.totalAmount} ₽`,
    );
    return { alreadyPaid: false, order: updated };
  }

  // Провал онлайн-оплаты: заказ уходит в CANCELLED, клиент может собрать
  // новый. Повторный вебхук по уже закрытому заказу — молча ок.
  async cancelOnlinePayment(orderId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status === 'AWAITING_PAYMENT' && order.paymentMethod === 'CARD_ONLINE') {
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason },
      });
      const webhookActor: JwtPayload = { sub: 'acquiring-webhook', role: 'CEO', gymId: order.gymId };
      await this.activityLog.log(webhookActor, 'Онлайн-оплата не прошла — заказ отменён', order.clientId, reason);
      return { cancelled: true, order: updated };
    }
    return { cancelled: false, order };
  }

  async cancelOrder(actor: JwtPayload, orderId: string, reason?: string) {
    const order = await this.getOwnedOrder(actor, orderId);
    if (order.status === 'PAID') throw new BadRequestException('Оплаченный заказ нельзя отменить — возврат оформляется отдельно (P0.7)');
    if (order.status === 'CANCELLED' || order.status === 'EXPIRED') return order;

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? null },
      include: { lines: true },
    });
    await this.activityLog.log(actor, 'Отменил заказ', order.client.name, reason ?? 'Без указания причины');
    return updated;
  }

  private async markExpired(orderId: string) {
    await this.prisma.order.updateMany({
      where: { id: orderId, status: 'AWAITING_PAYMENT' },
      data: { status: 'EXPIRED', cancelledAt: new Date() },
    });
  }

  // "Брошенные" заказы: никто не подтвердил оплату в пределах таймаута
  // (клиент передумал, администратора отвлекли, кончилась смена) — не должны
  // копиться в AWAITING_PAYMENT бессрочно и путать администратора при
  // следующей попытке оформить тому же клиенту новый заказ.
  async expireStale() {
    const stale = await this.prisma.order.findMany({
      where: { status: 'AWAITING_PAYMENT', expiresAt: { lt: new Date() } },
      select: { id: true },
    });
    if (stale.length === 0) return;
    await this.prisma.order.updateMany({
      where: { id: { in: stale.map((o) => o.id) } },
      data: { status: 'EXPIRED', cancelledAt: new Date() },
    });
    this.logger.log(`Просрочено заказов без подтверждения оплаты: ${stale.length}`);
  }

  findOpen(gymId: string) {
    return this.prisma.order.findMany({
      where: { gymId, status: { in: ['DRAFT', 'AWAITING_PAYMENT'] } },
      include: { lines: true, client: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Оплаченные заказы клиента — для того, чтобы администратор мог найти
  // заказ и оформить по нему возврат (P0.7).
  findPaidByClient(gymId: string, clientId: string) {
    return this.prisma.order.findMany({
      where: { gymId, clientId, status: 'PAID' },
      include: { lines: true, client: true },
      orderBy: { paidAt: 'desc' },
      take: 20,
    });
  }

  async findOwn(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) return [];
    return this.prisma.order.findMany({
      where: { clientId: client.id },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  findOne(actor: JwtPayload, orderId: string) {
    return this.getOwnedOrder(actor, orderId);
  }
}
