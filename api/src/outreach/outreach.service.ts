import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class OutreachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Клиенты с их абонементом и последней заметкой по обзвону — фильтр
  // "истёк N недель назад" считается на фронте по expiresAt, как в демо.
  async listWithNotes(gymId: string) {
    const clients = await this.prisma.client.findMany({
      where: { gymId },
      include: { membership: true },
      orderBy: { name: 'asc' },
    });
    const notes = await this.prisma.outreachNote.findMany({ where: { gymId }, orderBy: { date: 'desc' } });
    const latestByClient = new Map<string, (typeof notes)[number]>();
    for (const n of notes) if (!latestByClient.has(n.clientId)) latestByClient.set(n.clientId, n);
    return clients.map((c) => ({ ...c, latestOutreachNote: latestByClient.get(c.id) ?? null }));
  }

  async create(actor: JwtPayload, clientId: string, called: boolean, reason: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    const note = await this.prisma.outreachNote.create({
      data: {
        gymId: actor.gymId,
        clientId,
        called,
        reason,
        authorId: actor.sub,
        authorName: actor.role === 'STAFF' ? 'Администратор' : 'CEO',
      },
    });
    await this.activityLog.log(
      actor,
      called ? 'Отметил звонок клиенту' : 'Отметил неудачную попытку дозвониться',
      client?.name ?? clientId,
      reason || '—',
    );
    return note;
  }
}
