import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(gymId: string) {
    const pricing = await this.prisma.membershipPricing.findUnique({ where: { gymId } });
    if (!pricing) throw new NotFoundException('Цены зала ещё не настроены');
    return pricing;
  }
}
