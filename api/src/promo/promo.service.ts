import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreatePromoCodeDto } from './dto/promo.dto';
import type { JwtPayload } from '../auth/auth.service';

// Промокоды (P4.4) — стандартный инструмент продаж: публичные акции
// (NEWYEAR2026, -20%), персональные бонусы (реферальные) и корпоративные
// комплименты. Применение к заказу — в orders.service (validatePromoCode),
// здесь только управление справочником кодов на своей точке.
@Injectable()
export class PromoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  list(gymId: string) {
    return this.prisma.promoCode.findMany({
      where: { gymId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { orders: true } } },
    });
  }

  async create(actor: JwtPayload, dto: CreatePromoCodeDto) {
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Код промокода не может быть пустым');
    if ((dto.percentOff != null) === (dto.amountOff != null)) {
      throw new BadRequestException('Укажите ровно одно: percentOff (процент) или amountOff (фиксированная сумма в рублях)');
    }
    const validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (validFrom && validUntil && validUntil <= validFrom) {
      throw new BadRequestException('Дата окончания действия должна быть позже даты начала');
    }
    const existing = await this.prisma.promoCode.findUnique({ where: { gymId_code: { gymId: actor.gymId, code } } });
    if (existing) throw new ConflictException(`Промокод ${code} уже существует на этой точке`);

    const created = await this.prisma.promoCode
      .create({
        data: {
          gymId: actor.gymId,
          code,
          title: dto.title ?? null,
          percentOff: dto.percentOff ?? null,
          amountOff: dto.amountOff ?? null,
          validFrom,
          validUntil,
          maxUses: dto.maxUses ?? 1,
        },
      })
      .catch((err: unknown) => {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException(`Промокод ${code} уже существует на этой точке`);
        }
        throw err;
      });
    const bonus = dto.percentOff != null ? `-${dto.percentOff}%` : `-${dto.amountOff} ₽`;
    await this.activityLog.log(actor, 'Создал промокод', code, `${dto.title ? `${dto.title}, ` : ''}${bonus}, применений: ${dto.maxUses ?? 1}`);
    return created;
  }

  async setActive(actor: JwtPayload, promoId: string, isActive: boolean) {
    const promo = await this.prisma.promoCode.findFirst({ where: { id: promoId, gymId: actor.gymId } });
    if (!promo) throw new NotFoundException('Промокод не найден');
    const updated = await this.prisma.promoCode.update({ where: { id: promo.id }, data: { isActive } });
    await this.activityLog.log(actor, isActive ? 'Включил промокод' : 'Выключил промокод', promo.code, '');
    return updated;
  }

  // Удалять можно только никогда не применявшийся код: у использованного
  // есть заказы с FK — историю продаж не вычищаем, выключаем вместо этого.
  async remove(actor: JwtPayload, promoId: string) {
    const promo = await this.prisma.promoCode.findFirst({
      where: { id: promoId, gymId: actor.gymId },
      include: { _count: { select: { orders: true } } },
    });
    if (!promo) throw new NotFoundException('Промокод не найден');
    if (promo._count.orders > 0) {
      throw new ConflictException('Промокод уже применён в заказах — выключите его вместо удаления');
    }
    await this.prisma.promoCode.delete({ where: { id: promo.id } });
    await this.activityLog.log(actor, 'Удалил промокод', promo.code, '');
    return { deleted: true };
  }
}
