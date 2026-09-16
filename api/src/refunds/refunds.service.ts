import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderLineType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { MEMBERSHIP_LABEL } from '../clients/membership.const';
import { amountsMatchToKopeck, parseFiscalReceiptQr } from '../orders/receipt-qr.util';
import type { JwtPayload } from '../auth/auth.service';

// Возврат оплаты (P0.7) — по 54-ФЗ отмена платежа не "удалить транзакцию из
// базы", а отдельный фискальный документ "чек возврата прихода". Работает
// той же схемой, что и приём оплаты в P0.2: запрос на возврат ничего не
// откатывает сам по себе, откат применяется только после того, как чек
// возврата отсканирован и его сумма совпала.
@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  private async getOwnedRefund(actor: JwtPayload, refundId: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId, gymId: actor.gymId },
      include: { order: { include: { lines: true, client: true } } },
    });
    if (!refund) throw new NotFoundException('Возврат не найден');
    return refund;
  }

  async requestRefund(actor: JwtPayload, orderId: string, reason: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, gymId: actor.gymId }, include: { client: true } });
    if (!order) throw new NotFoundException('Заказ не найден');
    if (order.status !== 'PAID') throw new BadRequestException('Возврат можно оформить только по оплаченному заказу');

    const active = await this.prisma.refund.findFirst({ where: { orderId, status: { in: ['AWAITING_RECEIPT', 'CONFIRMED'] } } });
    if (active) {
      throw new BadRequestException(
        active.status === 'CONFIRMED' ? 'По этому заказу уже оформлен возврат' : 'По этому заказу уже есть незакрытый запрос на возврат',
      );
    }

    const refund = await this.prisma.refund.create({
      data: { gymId: actor.gymId, orderId, requestedBy: actor.sub, reason: reason.trim(), amount: order.totalAmount, status: 'AWAITING_RECEIPT' },
      include: { order: { include: { lines: true, client: true } } },
    });
    await this.activityLog.log(actor, 'Запросил возврат по заказу', order.client.name, `${order.totalAmount} ₽ — ${reason.trim()}`);
    return refund;
  }

  async cancelRefund(actor: JwtPayload, refundId: string) {
    const refund = await this.getOwnedRefund(actor, refundId);
    if (refund.status !== 'AWAITING_RECEIPT') throw new BadRequestException('Отменить можно только возврат, который ещё ожидает чека');
    const updated = await this.prisma.refund.update({ where: { id: refundId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
    await this.activityLog.log(actor, 'Отменил запрос на возврат', refund.order.client.name, `${refund.amount} ₽`);
    return updated;
  }

  // Откатывает ОДНУ позицию исходного заказа. Возвращает человекочитаемое
  // описание того, что реально произошло — для аудита (CEO должен видеть не
  // просто "деньги вернули", а что именно откатилось).
  private async rollbackLine(
    tx: Prisma.TransactionClient,
    clientId: string,
    line: { type: OrderLineType; refId: string | null; meta: Prisma.JsonValue },
  ): Promise<string> {
    const meta = (line.meta ?? {}) as Record<string, any>;
    const prev = meta._prevState as Record<string, any> | undefined;

    switch (line.type) {
      case 'MEMBERSHIP_PURCHASE':
      case 'MEMBERSHIP_RENEWAL': {
        if (!prev) return 'Нет данных для отката абонемента (заказ оформлен до появления возвратов) — откат не выполнен, деньги возвращены';
        if (!prev.hadMembership) {
          await tx.membership.deleteMany({ where: { clientId } });
          return 'Абонемент отменён — до этого заказа у клиента абонемента не было';
        }
        await tx.membership.update({
          where: { clientId },
          data: {
            type: prev.type,
            purchasedAt: new Date(prev.purchasedAt),
            expiresAt: prev.expiresAt ? new Date(prev.expiresAt) : null,
            visitsTotal: prev.visitsTotal,
            visitsLeft: prev.visitsLeft,
            status: prev.status,
          },
        });
        return `Абонемент возвращён к состоянию до заказа (${MEMBERSHIP_LABEL[prev.type as keyof typeof MEMBERSHIP_LABEL]})`;
      }

      case 'TARIFF_CHANGE': {
        if (!prev) return 'Нет данных для отката тарифа (заказ оформлен до появления возвратов) — откат не выполнен, деньги возвращены';
        const today = new Date();
        await tx.clientFormatHistoryEntry.updateMany({ where: { clientId, to: null }, data: { to: today } });
        await tx.clientFormatHistoryEntry.create({ data: { clientId, trainerId: prev.trainerId, format: prev.format, from: today, to: null } });
        await tx.client.update({ where: { id: clientId }, data: { trainerId: prev.trainerId, tariff: prev.tariff, format: prev.format } });
        return 'Тариф и тренер возвращены к состоянию до заказа';
      }

      case 'STOCK_PURCHASE': {
        // Покупка товара в P0.2 сознательно не списывает остаток склада
        // (то же поведение, что было в демо-версии) — значит и возврату
        // физически нечего возвращать на склад; откатываются только деньги.
        return 'Остаток склада не менялся при продаже — при возврате товар тоже не тронут, возвращены только деньги';
      }

      case 'LOCKER_RENTAL': {
        const locker = await tx.locker.findUnique({ where: { id: line.refId! } });
        if (locker && locker.rentedBy === clientId) {
          await tx.locker.update({ where: { id: locker.id }, data: { status: 'FREE', rentedBy: null, rentedUntil: null } });
          return `Шкафчик №${locker.number} освобождён`;
        }
        return 'Шкафчик уже не занят этим клиентом (переарендован или освобождён администратором ранее) — не тронут';
      }

      case 'GROUP_CLASS_BOOKING': {
        const deleted = await tx.groupClassBooking.deleteMany({ where: { groupClassId: line.refId!, clientId } });
        return deleted.count > 0 ? 'Запись на групповое занятие снята' : 'Запись уже была отменена клиентом ранее';
      }

      case 'PERSONAL_SLOT_BOOKING': {
        const slot = await tx.personalSlot.findUnique({ where: { id: line.refId! } });
        if (slot && slot.clientId === clientId && slot.status === 'BOOKED') {
          await tx.personalSlot.update({ where: { id: slot.id }, data: { status: 'FREE', clientId: null } });
          return 'Персональный слот освобождён';
        }
        return 'Слот уже проведён или отменён ранее — бронирование не тронуто';
      }

      default:
        return `Неизвестный тип позиции заказа: ${line.type as string} — откат не выполнен`;
    }
  }

  async confirmReceipt(actor: JwtPayload, refundId: string, qrRaw: string) {
    const refund = await this.getOwnedRefund(actor, refundId);
    if (refund.status !== 'AWAITING_RECEIPT') {
      throw new BadRequestException(refund.status === 'CONFIRMED' ? 'Возврат уже подтверждён' : 'Запрос на возврат отменён');
    }

    const receipt = parseFiscalReceiptQr(qrRaw);
    // Тип операции в фискальном QR (тег ФФД 1054): 1 — приход, 2 — возврат
    // прихода, 3 — расход, 4 — возврат расхода. Без этой проверки обычный
    // чек прихода можно случайно (или намеренно) отсканировать как возврат.
    if (receipt.operationType !== '2') {
      throw new BadRequestException(
        `Это не похоже на чек возврата прихода — тип операции в чеке: ${receipt.operationType ?? 'не указан'}, ожидается 2 (возврат прихода). Отсканируйте именно чек возврата, пробитый на кассе.`,
      );
    }

    // Один и тот же чек не может быть использован ни как чек оплаты, ни как
    // чек возврата дважды — проверяем обе таблицы.
    const [usedAsOrder, usedAsRefund] = await Promise.all([
      this.prisma.order.findUnique({ where: { receiptFn_receiptI_receiptFp: { receiptFn: receipt.fn, receiptI: receipt.i, receiptFp: receipt.fp } } }),
      this.prisma.refund.findUnique({ where: { receiptFn_receiptI_receiptFp: { receiptFn: receipt.fn, receiptI: receipt.i, receiptFp: receipt.fp } } }),
    ]);
    if (usedAsOrder || (usedAsRefund && usedAsRefund.id !== refund.id)) {
      await this.activityLog.log(
        actor,
        'Подозрение: повторное использование чека (возврат)',
        refund.order.client.name,
        `Чек fn=${receipt.fn} i=${receipt.i} fp=${receipt.fp} уже использован для другого заказа/возврата, попытка привязать к возврату ${refund.id}`,
      );
      throw new ConflictException('Этот чек уже был использован для другого заказа или возврата');
    }

    if (!amountsMatchToKopeck(refund.amount, receipt.amountRub)) {
      throw new BadRequestException(
        `Сумма чека не совпадает с суммой возврата: в чеке ${receipt.amountRub.toFixed(2)} ₽, к возврату ${refund.amount} ₽. Возврат остаётся открытым — отсканируйте корректный чек или отмените запрос.`,
      );
    }

    const confirmedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const line of refund.order.lines) {
        const detail = await this.rollbackLine(tx, refund.order.clientId, line);
        await tx.refundLine.create({ data: { refundId: refund.id, orderLineId: line.id, detail } });
      }
      await tx.transaction.create({
        data: {
          gymId: refund.gymId,
          amount: -refund.amount,
          category: 'REFUND',
          clientId: refund.order.clientId,
          description: `Возврат по заказу от ${refund.order.paidAt?.toISOString().slice(0, 10) ?? '—'} — ${refund.reason}`,
          orderId: refund.orderId,
        },
      });
      await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: 'CONFIRMED',
          confirmedAt,
          receiptRaw: receipt.raw,
          receiptDate: receipt.date,
          receiptFn: receipt.fn,
          receiptI: receipt.i,
          receiptFp: receipt.fp,
        },
      });
    });

    await this.activityLog.log(actor, 'Подтвердил возврат чеком', refund.order.client.name, `${refund.amount} ₽, чек fn=${receipt.fn}`);
    return this.prisma.refund.findUnique({ where: { id: refund.id }, include: { lines: true, order: true } });
  }

  findOpen(gymId: string) {
    return this.prisma.refund.findMany({
      where: { gymId, status: 'AWAITING_RECEIPT' },
      include: { order: { include: { client: true, lines: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(actor: JwtPayload, refundId: string) {
    return this.getOwnedRefund(actor, refundId);
  }
}
