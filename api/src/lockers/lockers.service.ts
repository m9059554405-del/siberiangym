import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class LockersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(gymId: string) {
    return this.prisma.locker.findMany({ where: { gymId }, orderBy: { number: 'asc' } });
  }

  async rent(actor: JwtPayload, lockerId: string, days: number, explicitClientId?: string) {
    const locker = await this.prisma.locker.findFirst({ where: { id: lockerId, gymId: actor.gymId } });
    if (!locker) throw new NotFoundException('Шкафчик не найден');
    if (locker.status !== 'FREE') throw new BadRequestException('Шкафчик уже занят');

    let clientId = explicitClientId;
    if (actor.role === 'CLIENT') {
      const own = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
      if (!own) throw new ForbiddenException('У пользователя нет карточки клиента');
      clientId = own.id;
    }
    if (!clientId) throw new BadRequestException('Не указан clientId');

    const rentedUntil = new Date(Date.now() + days * 86400000);
    const [updated] = await this.prisma.$transaction([
      this.prisma.locker.update({ where: { id: lockerId }, data: { status: 'RENTED', rentedBy: clientId, rentedUntil } }),
      this.prisma.transaction.create({
        data: {
          gymId: actor.gymId,
          amount: locker.pricePerDay * days,
          category: 'ANCILLARY',
          clientId,
          description: `Аренда кабинки №${locker.number} (${days} дн.)`,
        },
      }),
    ]);
    return updated;
  }

  async release(actor: JwtPayload, lockerId: string) {
    const locker = await this.prisma.locker.findFirst({ where: { id: lockerId, gymId: actor.gymId } });
    if (!locker) throw new NotFoundException('Шкафчик не найден');
    return this.prisma.locker.update({ where: { id: lockerId }, data: { status: 'FREE', rentedBy: null, rentedUntil: null } });
  }
}
