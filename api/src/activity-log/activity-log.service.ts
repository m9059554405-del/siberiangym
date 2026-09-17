import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

// Единая точка записи в журнал изменений CEO — "кто, что, когда, на что
// повлияло". Используется из всех модулей, где происходят значимые
// административные действия (перенесено из withLog() демо-версии).
@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveActorName(actor: JwtPayload): Promise<string> {
    if (actor.role === 'CLIENT') {
      const c = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
      return c?.name ?? 'Клиент';
    }
    if (actor.role === 'TRAINER') {
      const t = await this.prisma.trainer.findUnique({ where: { userId: actor.sub } });
      return t?.name ?? 'Тренер';
    }
    if (actor.role === 'STAFF') {
      const u = await this.prisma.user.findUnique({ where: { id: actor.sub }, select: { name: true } });
      return u?.name ?? 'Администратор';
    }
    return 'CEO';
  }

  async log(actor: JwtPayload, action: string, target: string, details: string) {
    const actorName = await this.resolveActorName(actor);
    return this.prisma.activityLogEntry.create({
      data: {
        gymId: actor.gymId,
        actorId: actor.sub,
        actorRole: actor.role,
        actorName,
        action,
        target,
        details,
      },
    });
  }

  findAll(gymId: string, limit = 200) {
    return this.prisma.activityLogEntry.findMany({
      where: { gymId },
      orderBy: { date: 'desc' },
      take: limit,
    });
  }
}
