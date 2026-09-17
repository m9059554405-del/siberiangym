import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  async get(gymId: string) {
    const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId } });
    if (!pricing) throw new NotFoundException('Цены зала ещё не настроены');
    return pricing;
  }

  // Раньше редактировать цены можно было только напрямую в БД — ни одного
  // эндпоинта не существовало вообще. Понадобилось для P1.2 (сетевые цены
  // нечем задать иначе), заодно закрывает и обычные цены точки.
  async update(actor: JwtPayload, dto: UpdatePricingDto) {
    const existing = await this.prisma.membershipPricing.findUnique({ where: { gymId: actor.gymId } });
    if (!existing) throw new NotFoundException('Цены зала ещё не настроены');
    const updated = await this.prisma.membershipPricing.update({ where: { gymId: actor.gymId }, data: dto });
    await this.activityLog.log(actor, 'Изменил цены абонементов', 'Тарифы', JSON.stringify(dto));
    return updated;
  }
}
