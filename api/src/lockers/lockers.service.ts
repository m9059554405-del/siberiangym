import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class LockersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(gymId: string) {
    return this.prisma.locker.findMany({ where: { gymId }, orderBy: { number: 'asc' } });
  }

  // Аренда шкафчика — с P0.2 идёт через POST /orders (LOCKER_RENTAL) и
  // применяется только после подтверждения оплаты чеком, см.
  // api/src/orders/orders.service.ts.

  async release(actor: JwtPayload, lockerId: string) {
    const locker = await this.prisma.locker.findFirst({ where: { id: lockerId, gymId: actor.gymId } });
    if (!locker) throw new NotFoundException('Шкафчик не найден');
    return this.prisma.locker.update({ where: { id: lockerId }, data: { status: 'FREE', rentedBy: null, rentedUntil: null } });
  }
}
