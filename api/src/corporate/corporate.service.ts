import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AddCorporateMemberDto, CreateCorporateAccountDto, UpdateCorporateAccountDto } from './dto/corporate.dto';
import type { JwtPayload } from '../auth/auth.service';

// Корпоративные абонементы (P4.4): компания-работодатель договаривается с
// клубом, её сотрудники (обычные клиенты клуба) состоят в списке договора,
// их заказы атрибутируются договору и попадают в сводную ведомость для
// бухгалтерии компании. Договорная скидка применяется к заказам участников
// автоматически (orders.service), если не сработал больший промокод.
@Injectable()
export class CorporateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  list(gymId: string) {
    return this.prisma.corporateAccount.findMany({
      where: { gymId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { members: true } } },
    });
  }

  async detail(actor: JwtPayload, id: string) {
    const account = await this.prisma.corporateAccount.findFirst({
      where: { id, gymId: actor.gymId },
      include: { members: { include: { client: { select: { id: true, name: true, phone: true } } }, orderBy: { addedAt: 'asc' } } },
    });
    if (!account) throw new NotFoundException('Корпоративный договор не найден');
    return account;
  }

  async create(actor: JwtPayload, dto: CreateCorporateAccountDto) {
    const created = await this.prisma.corporateAccount.create({
      data: {
        gymId: actor.gymId,
        name: dto.name.trim(),
        contactPerson: dto.contactPerson?.trim() ?? null,
        contactPhone: dto.contactPhone?.trim() ?? null,
        discountPercent: dto.discountPercent ?? 0,
      },
    });
    await this.activityLog.log(actor, 'Создал корпоративный договор', created.name, `скидка ${created.discountPercent}%`);
    return created;
  }

  async update(actor: JwtPayload, id: string, dto: UpdateCorporateAccountDto) {
    const account = await this.prisma.corporateAccount.findFirst({ where: { id, gymId: actor.gymId } });
    if (!account) throw new NotFoundException('Корпоративный договор не найден');
    const updated = await this.prisma.corporateAccount.update({
      where: { id: account.id },
      data: {
        name: dto.name?.trim() ?? account.name,
        contactPerson: dto.contactPerson !== undefined ? dto.contactPerson.trim() || null : account.contactPerson,
        contactPhone: dto.contactPhone !== undefined ? dto.contactPhone.trim() || null : account.contactPhone,
        discountPercent: dto.discountPercent ?? account.discountPercent,
        isActive: dto.isActive ?? account.isActive,
      },
    });
    await this.activityLog.log(actor, 'Изменил корпоративный договор', updated.name, `скидка ${updated.discountPercent}%, ${updated.isActive ? 'активен' : 'деактивирован'}`);
    return updated;
  }

  // Договор с заказами не удаляется — ведомость компании должна показывать
  // историю продаж; вместо удаления деактивируйте его (isActive=false).
  async remove(actor: JwtPayload, id: string) {
    const account = await this.prisma.corporateAccount.findFirst({
      where: { id, gymId: actor.gymId },
      include: { _count: { select: { orders: true } } },
    });
    if (!account) throw new NotFoundException('Корпоративный договор не найден');
    if (account._count.orders > 0) {
      throw new ConflictException('По договору уже есть заказы — деактивируйте его вместо удаления');
    }
    await this.prisma.corporateAccount.delete({ where: { id: account.id } });
    await this.activityLog.log(actor, 'Удалил корпоративный договор', account.name, '');
    return { deleted: true };
  }

  async addMember(actor: JwtPayload, id: string, dto: AddCorporateMemberDto) {
    const account = await this.prisma.corporateAccount.findFirst({ where: { id, gymId: actor.gymId } });
    if (!account) throw new NotFoundException('Корпоративный договор не найден');
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    try {
      const member = await this.prisma.corporateMember.create({
        data: { corporateAccountId: account.id, clientId: client.id },
        include: { client: { select: { id: true, name: true, phone: true } } },
      });
      await this.activityLog.log(actor, 'Добавил клиента в корпоративный договор', client.name, account.name);
      return member;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Этот клиент уже состоит в договоре');
      }
      throw err;
    }
  }

  async removeMember(actor: JwtPayload, id: string, clientId: string) {
    const member = await this.prisma.corporateMember.findFirst({
      where: { corporateAccountId: id, clientId, corporateAccount: { gymId: actor.gymId } },
      include: { client: { select: { name: true } }, corporateAccount: { select: { name: true } } },
    });
    if (!member) throw new NotFoundException('Клиент не состоит в этом договоре');
    await this.prisma.corporateMember.delete({ where: { id: member.id } });
    await this.activityLog.log(actor, 'Исключил клиента из корпоративного договора', member.client.name, member.corporateAccount.name);
    return { removed: true };
  }

  // Сводная ведомость для бухгалтерии компании: оплаченные заказы всех
  // участников договора + итоговая сумма.
  async statement(actor: JwtPayload, id: string) {
    const account = await this.prisma.corporateAccount.findFirst({ where: { id, gymId: actor.gymId } });
    if (!account) throw new NotFoundException('Корпоративный договор не найден');
    const orders = await this.prisma.order.findMany({
      where: { corporateAccountId: account.id, status: 'PAID' },
      include: {
        client: { select: { name: true } },
        lines: true,
      },
      orderBy: { paidAt: 'desc' },
    });
    const totalRub = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    return {
      account: { id: account.id, name: account.name, discountPercent: account.discountPercent, isActive: account.isActive },
      orders: orders.map((o) => ({
        id: o.id,
        clientName: o.client.name,
        totalAmount: o.totalAmount,
        discount: o.discount,
        paidAt: o.paidAt,
        lines: o.lines.map((l) => ({ type: l.type, amount: l.amount })),
      })),
      count: orders.length,
      totalRub,
    };
  }
}
