import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { StockLocation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { ReceiveStockDto, WriteOffStockDto, FinalizeInventoryDto } from './dto/stock-operations.dto';
import type { JwtPayload } from '../auth/auth.service';

const WRITEOFF_REASON_LABEL: Record<string, string> = {
  EXPIRED: 'Истёк срок годности',
  DAMAGED: 'Повреждено',
  SOLD_MANUAL: 'Продано без чека',
  USED_INTERNALLY: 'Использовано клубом',
  LOST: 'Утеряно/недостача',
  OTHER: 'Другое',
};

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  listCatalog(gymId: string) {
    return this.prisma.catalogItem.findMany({ where: { gymId }, orderBy: { name: 'asc' } });
  }

  async createCatalogItem(actor: JwtPayload, dto: CreateCatalogItemDto) {
    const item = await this.prisma.catalogItem.create({ data: { gymId: actor.gymId, ...dto } });
    await this.activityLog.log(actor, 'Добавил товар в справочник', item.name, `${dto.category === 'FOOD' ? 'Еда' : 'Вода'} · ${dto.price} ₽`);
    return item;
  }

  // Остатки по товарам и локациям — сгруппированные партии, аналог
  // getStockSummary() из демо-версии.
  async summary(gymId: string) {
    const items = await this.prisma.catalogItem.findMany({
      where: { gymId },
      include: { stockBatches: true },
    });
    const today = new Date();
    return items.map((item) => {
      const batches = item.stockBatches.map((b) => {
        const daysLeft = Math.round((b.expiresAt.getTime() - today.getTime()) / 86400000);
        return { ...b, daysLeft, expiringSoon: daysLeft <= 14 };
      });
      return {
        catalogItemId: item.id,
        name: item.name,
        category: item.category,
        emoji: item.emoji,
        shelfQty: batches.filter((b) => b.location === 'SHELF').reduce((s, b) => s + b.quantity, 0),
        warehouseQty: batches.filter((b) => b.location === 'WAREHOUSE').reduce((s, b) => s + b.quantity, 0),
        batches: batches.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime()),
      };
    });
  }

  // Покупка товара клиентом в приложении (вода/еда) — просто фиксирует
  // транзакцию, без учёта остатков (так же, как в демо-версии).
  async purchase(actor: JwtPayload, catalogItemId: string) {
    const item = await this.prisma.catalogItem.findFirst({ where: { id: catalogItemId, gymId: actor.gymId } });
    if (!item) throw new NotFoundException('Товар не найден');
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');

    return this.prisma.transaction.create({
      data: {
        gymId: actor.gymId,
        amount: item.price,
        category: 'ANCILLARY',
        clientId: client.id,
        description: item.name,
      },
    });
  }

  async receive(actor: JwtPayload, dto: ReceiveStockDto) {
    const item = await this.prisma.catalogItem.findFirst({ where: { id: dto.catalogItemId, gymId: actor.gymId } });
    if (!item) throw new NotFoundException('Товар не найден в справочнике');

    const [batch] = await this.prisma.$transaction([
      this.prisma.stockBatch.create({
        data: {
          gymId: actor.gymId,
          catalogItemId: dto.catalogItemId,
          location: dto.location,
          quantity: dto.quantity,
          receivedAt: new Date(),
          expiresAt: new Date(dto.expiresAt),
        },
      }),
      this.prisma.stockReceipt.create({
        data: { gymId: actor.gymId, catalogItemId: dto.catalogItemId, location: dto.location, quantity: dto.quantity, authorId: actor.sub },
      }),
    ]);

    await this.activityLog.log(actor, 'Оприходовал товар на склад', item.name, `+${dto.quantity} шт. (${dto.location === 'SHELF' ? 'витрина' : 'склад'})`);
    return batch;
  }

  // Списываем со СТАРЕЙШИХ по сроку годности партий этого товара в этой
  // локации — так же, как в реальности сначала расходуют то, что раньше
  // истечёт. Излишек сверх фактического остатка просто игнорируется.
  private async decrementBatches(gymId: string, catalogItemId: string, location: StockLocation, qty: number) {
    const batches = await this.prisma.stockBatch.findMany({
      where: { gymId, catalogItemId, location, quantity: { gt: 0 } },
      orderBy: { expiresAt: 'asc' },
    });
    let remaining = qty;
    const updates: { id: string; quantity: number }[] = [];
    for (const b of batches) {
      if (remaining <= 0) break;
      const take = Math.min(b.quantity, remaining);
      updates.push({ id: b.id, quantity: b.quantity - take });
      remaining -= take;
    }
    await this.prisma.$transaction(updates.map((u) => this.prisma.stockBatch.update({ where: { id: u.id }, data: { quantity: u.quantity } })));
  }

  async writeOff(actor: JwtPayload, dto: WriteOffStockDto) {
    const item = await this.prisma.catalogItem.findFirst({ where: { id: dto.catalogItemId, gymId: actor.gymId } });
    if (!item) throw new NotFoundException('Товар не найден в справочнике');

    await this.decrementBatches(actor.gymId, dto.catalogItemId, dto.location, dto.quantity);
    const writeoff = await this.prisma.stockWriteoff.create({
      data: {
        gymId: actor.gymId,
        catalogItemId: dto.catalogItemId,
        location: dto.location,
        quantity: dto.quantity,
        reason: dto.reason,
        comment: dto.comment,
        authorId: actor.sub,
      },
    });

    await this.activityLog.log(
      actor,
      'Списал товар со склада',
      item.name,
      `-${dto.quantity} шт. (${WRITEOFF_REASON_LABEL[dto.reason]})${dto.comment ? ` — ${dto.comment}` : ''}`,
    );
    return writeoff;
  }

  async finalizeInventory(actor: JwtPayload, dto: FinalizeInventoryDto) {
    const countEntries: { catalogItemId: string; location: StockLocation; systemQty: number; countedQty: number }[] = [];

    for (const e of dto.entries) {
      const batches = await this.prisma.stockBatch.findMany({
        where: { gymId: actor.gymId, catalogItemId: e.catalogItemId, location: e.location },
      });
      const systemQty = batches.reduce((s, b) => s + b.quantity, 0);
      const diff = e.countedQty - systemQty;
      countEntries.push({ catalogItemId: e.catalogItemId, location: e.location, systemQty, countedQty: e.countedQty });

      if (diff > 0) {
        await this.prisma.stockBatch.create({
          data: {
            gymId: actor.gymId,
            catalogItemId: e.catalogItemId,
            location: e.location,
            quantity: diff,
            receivedAt: new Date(),
            expiresAt: new Date(Date.now() + 180 * 86400000),
          },
        });
      } else if (diff < 0) {
        await this.decrementBatches(actor.gymId, e.catalogItemId, e.location, -diff);
      }
    }

    const inventoryCount = await this.prisma.inventoryCount.create({
      data: {
        gymId: actor.gymId,
        authorId: actor.sub,
        entries: { create: countEntries },
      },
      include: { entries: true },
    });

    const mismatches = countEntries.filter((e) => e.countedQty !== e.systemQty).length;
    await this.activityLog.log(actor, 'Завершил инвентаризацию', `${countEntries.length} позиций`, mismatches > 0 ? `Расхождений: ${mismatches}` : 'Расхождений не найдено');
    return inventoryCount;
  }

  history(gymId: string, limit = 30) {
    return Promise.all([
      this.prisma.stockWriteoff.findMany({ where: { gymId }, orderBy: { date: 'desc' }, take: limit, include: { catalogItem: true } }),
      this.prisma.stockReceipt.findMany({ where: { gymId }, orderBy: { date: 'desc' }, take: limit, include: { catalogItem: true } }),
      this.prisma.inventoryCount.findMany({ where: { gymId }, orderBy: { date: 'desc' }, take: limit, include: { entries: true } }),
    ]).then(([writeoffs, receipts, inventoryCounts]) => ({ writeoffs, receipts, inventoryCounts }));
  }
}
