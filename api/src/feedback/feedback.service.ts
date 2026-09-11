import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  async findForClient(actor: JwtPayload, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    if (actor.role === 'CLIENT' && client.userId !== actor.sub) {
      throw new ForbiddenException('Можно смотреть только свою переписку');
    }
    return this.prisma.feedbackMessage.findMany({ where: { clientId }, orderBy: { date: 'asc' } });
  }

  async create(actor: JwtPayload, clientId: string, text: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');

    let from: 'client' | 'trainer';
    if (actor.role === 'CLIENT') {
      const own = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
      if (own?.id !== clientId) throw new ForbiddenException('Можно писать только в свою переписку');
      from = 'client';
    } else if (actor.role === 'TRAINER') {
      from = 'trainer';
    } else {
      from = 'trainer'; // CEO/STAFF пишут от имени тренера, если понадобится модерация
    }

    return this.prisma.feedbackMessage.create({ data: { clientId, from, text } });
  }
}
