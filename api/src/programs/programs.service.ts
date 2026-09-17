import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { SetProgramDto } from './dto/set-program.dto';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // P1.6: тренер работает только с подопечными — trainerId читается в
  // моменте, поэтому переназначение клиента другому тренеру сразу закрывает
  // старому доступ и к чтению, и к изменению текущей программы.
  private async assertTrainerOwnsClient(actor: JwtPayload, client: { trainerId: string | null }) {
    if (actor.role !== 'TRAINER') return;
    const trainer = await this.prisma.trainer.findUnique({ where: { userId: actor.sub } });
    if (!trainer || client.trainerId !== trainer.id) {
      throw new ForbiddenException('Можно работать только со своими подопечными');
    }
  }

  async getForClient(actor: JwtPayload, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    if (actor.role === 'CLIENT' && client.userId !== actor.sub) {
      throw new ForbiddenException('Можно смотреть только свою программу');
    }
    await this.assertTrainerOwnsClient(actor, client);
    return this.prisma.program.findUnique({
      where: { clientId },
      include: { days: { orderBy: { order: 'asc' }, include: { entries: { orderBy: { order: 'asc' } } } } },
    });
  }

  // Клиент может задать программу только себе; тренер — только своему
  // подопечному (P1.6: при переназначении клиента другому тренеру доступ
  // старого к текущей программе закрывается сразу); CEO/STAFF — любому
  // клиенту зала. assignedBy проставляется автоматически по роли вызывающего.
  async set(actor: JwtPayload, clientId: string, dto: SetProgramDto) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    if (actor.role === 'CLIENT') {
      const own = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
      if (own?.id !== clientId) throw new ForbiddenException('Можно менять только свою программу');
    }
    await this.assertTrainerOwnsClient(actor, client);
    const assignedBy = actor.role === 'CLIENT' ? 'self' : 'trainer';

    await this.prisma.program.deleteMany({ where: { clientId } });
    const program = await this.prisma.program.create({
      data: {
        clientId,
        assignedBy,
        days: {
          create: dto.days.map((d) => ({
            label: d.label,
            order: d.order,
            entries: { create: d.entries.map((e) => ({ ...e })) },
          })),
        },
      },
      include: { days: { include: { entries: true } } },
    });

    if (assignedBy === 'trainer') {
      await this.prisma.client.update({ where: { id: clientId }, data: { splitPlan: dto.days.map((d) => d.label) } });
    }
    await this.activityLog.log(actor, 'Изменил программу тренировок', client.name, `Дней в сплите: ${dto.days.length}`);
    return program;
  }
}
