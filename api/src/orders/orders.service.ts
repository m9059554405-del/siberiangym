import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MembershipScope, MembershipType, OrderLineType, Prisma, Tariff, TransactionCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { EmailService } from '../email/email.service';
import { CreateOrderDto, OrderLineInputDto } from './dto/create-order.dto';
import { formatForTariff, MEMBERSHIP_LABEL, VALIDITY_DAYS, VISITS_TOTAL } from '../clients/membership.const';
import { TARIFF_NAME, TARIFF_PRICE } from '../clients/tariffs.const';
import { isMinor as computeIsMinor } from '../clients/age.util';
import { amountsMatchToKopeck, parseFiscalReceiptQr } from './receipt-qr.util';
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
  ) {}

  // Просрочка "брошенных" заказов — периодический сдвиг статуса без внешнего
  // планировщика (в проекте пока нет @nestjs/schedule/BullMQ, см. P3-техдолг);
  // интервал внутри процесса — сознательно простое решение для одного
  // инстанса API, при переходе на кластер (P3.18) стоит заменить на
  // распределённый планировщик, чтобы не гонять просрочку в N копиях сразу.
  onModuleInit() {
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
  private async assertGuardianConsentsIfMinor(gymId: string, clientId: string): Promise<void> {
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
        type: { in: ['PDN_MINOR_GUARDIAN', 'ACTIVITY_WAIVER_MINOR_GUARDIAN'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    const latestByType = new Map<string, boolean>();
    for (const c of consents) {
      if (!latestByType.has(c.type)) latestByType.set(c.type, c.granted);
    }
    if (latestByType.get('PDN_MINOR_GUARDIAN') !== true || latestByType.get('ACTIVITY_WAIVER_MINOR_GUARDIAN') !== true) {
      throw new BadRequestException(
        'Оформление абонемента несовершеннолетнему требует подписанных согласий законного представителя (152-ФЗ и допуск к занятиям) — зафиксируйте их в карточке клиента',
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
        if (!tariff || !(tariff in TARIFF_PRICE)) throw new BadRequestException('Не указан или некорректен тариф');
        await this.assertGuardianConsentsIfMinor(gymId, clientId);
        const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId } });
        if (!client) throw new NotFoundException('Клиент не найден');
        const trainerId = (meta.trainerId as string | undefined) ?? input.refId ?? client.trainerId ?? undefined;
        if (!trainerId) throw new BadRequestException('Не указан тренер — сначала выберите тренера');
        const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, gymId } });
        if (!trainer) throw new NotFoundException('Тренер не найден');
        return {
          type: OrderLineType.TARIFF_CHANGE,
          refId: trainerId,
          amount: TARIFF_PRICE[tariff],
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
        const gc = await this.prisma.groupClass.findFirst({ where: { id: input.refId, gymId }, include: { bookings: true } });
        if (!gc) throw new NotFoundException('Занятие не найдено');
        if (gc.bookings.some((b) => b.clientId === clientId)) throw new BadRequestException('Клиент уже записан на это занятие');
        if (gc.bookings.length >= gc.capacity) throw new BadRequestException('Мест не осталось');
        const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId } });
        return { type: OrderLineType.GROUP_CLASS_BOOKING, refId: gc.id, amount: pricing?.groupSingle ?? 0, meta: { trainerId: gc.trainerId } };
      }

      case OrderLineType.PERSONAL_SLOT_BOOKING: {
        if (!input.refId) throw new BadRequestException('Не указан персональный слот');
        const slot = await this.prisma.personalSlot.findFirst({ where: { id: input.refId, gymId }, include: { trainer: true } });
        if (!slot) throw new NotFoundException('Слот не найден');
        if (slot.status !== 'FREE') throw new BadRequestException('Слот уже занят');
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

  // Применяет ОДНУ позицию заказа — только мутация состояния, без создания
  // Transaction (это делает вызывающий код в confirmReceipt внутри общей
  // транзакции БД, вместе для всех позиций разом). Повторно проверяет, что
  // ограниченный ресурс (шкафчик/слот/место в группе) всё ещё свободен —
  // окно между сборкой заказа и подтверждением чека ничем не заблокировано
  // (гонки при одновременном захвате ресурса — отдельный техдолг, см. P3.10).
  private async applyLine(
    tx: Prisma.TransactionClient,
    clientId: string,
    line: { type: OrderLineType; refId: string | null; amount: number; meta: Prisma.JsonValue },
  ): Promise<{
    description: string;
    trainerId: string | null;
    membership?: { type: MembershipType; expiresAt: Date | null };
    prevState?: Record<string, unknown>;
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
            }
          : { hadMembership: false };
        await tx.membership.upsert({
          where: { clientId },
          create: { clientId, type: membershipType, scope, purchasedAt: new Date(), expiresAt, visitsTotal, visitsLeft: visitsTotal, status: 'ACTIVE' },
          update: { type: membershipType, scope, purchasedAt: new Date(), expiresAt, visitsTotal, visitsLeft: visitsTotal, status: 'ACTIVE' },
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
        const gc = await tx.groupClass.findUniqueOrThrow({ where: { id: line.refId! }, include: { bookings: true } });
        if (gc.bookings.some((b) => b.clientId === clientId)) throw new ConflictException('Клиент уже записан на это занятие');
        if (gc.bookings.length >= gc.capacity) {
          throw new ConflictException('Мест на занятии больше не осталось — кто-то занял их, пока заказ ожидал оплаты');
        }
        await tx.groupClassBooking.create({ data: { groupClassId: gc.id, clientId } });
        return { description: `Запись на групповую тренировку — ${gc.type}`, trainerId: gc.trainerId };
      }

      case 'PERSONAL_SLOT_BOOKING': {
        const slot = await tx.personalSlot.findUniqueOrThrow({ where: { id: line.refId! }, include: { trainer: true } });
        if (slot.status !== 'FREE') {
          throw new ConflictException('Слот больше не свободен — кто-то занял его, пока заказ ожидал оплаты');
        }
        await tx.personalSlot.update({ where: { id: slot.id }, data: { status: 'BOOKED', clientId } });
        return { description: `Персональная тренировка — ${slot.trainer.name}`, trainerId: slot.trainerId };
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

    const paidAt = new Date();
    let confirmedMembership: { type: MembershipType; expiresAt: Date | null } | undefined;
    await this.prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        const applied = await this.applyLine(tx, order.clientId, line);
        if (applied.membership) confirmedMembership = applied.membership;
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

    await this.activityLog.log(
      actor,
      'Подтвердил оплату заказа чеком',
      order.client.name,
      `${order.lines.length} поз. на ${order.totalAmount} ₽, чек fn=${receipt.fn}`,
    );

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
