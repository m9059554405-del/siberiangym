import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GymsService } from '../gyms/gyms.service';
import type { JwtPayload } from '../auth/auth.service';

// Эндпоинт CEO-only, поэтому с P1.7 выручка отдаётся сразу по всей сети —
// сводка не требует раздельного захода в каждую точку. Точка приложена к
// каждой строке (gymId + имя) — по ней веб строит разбивку по точкам и
// фильтр «вся сеть / конкретная площадка».
@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService, private readonly gyms: GymsService) {}

  async findAll(actor: JwtPayload) {
    const gymIds = await this.gyms.resolveNetworkGymIds(actor);
    return this.prisma.transaction.findMany({
      where: { gymId: { in: gymIds } },
      include: { client: true, trainer: true, gym: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
  }
}
