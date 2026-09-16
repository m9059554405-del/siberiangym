import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateGuardianDto } from './dto/guardian.dto';
import type { JwtPayload } from '../auth/auth.service';

// Законный представитель несовершеннолетнего (P0.6) — отдельная сущность,
// а не обязательная карточка Client (ГК РФ ст. 26/28; 152-ФЗ): не входит
// в приложение сам (если не привязан к собственной карточке клиента),
// нужен только для фиксации согласий и связи.
@Injectable()
export class GuardiansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  // Поиск по телефону при заведении второго ребёнка того же родителя —
  // чтобы не плодить дубли с одинаковыми контактами (явно требует P0.6).
  search(gymId: string, phone: string) {
    return this.prisma.guardian.findMany({
      where: { gymId, phone: { contains: phone.trim() } },
      include: { children: { include: { client: true } } },
      take: 10,
    });
  }

  async findOne(actor: JwtPayload, id: string) {
    const guardian = await this.prisma.guardian.findFirst({
      where: { id, gymId: actor.gymId },
      include: { children: { include: { client: true } }, linkedClient: true },
    });
    if (!guardian) throw new NotFoundException('Законный представитель не найден');
    return guardian;
  }

  async listForClient(actor: JwtPayload, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    return this.prisma.guardian.findMany({
      where: { gymId: actor.gymId, children: { some: { clientId } } },
      include: { children: { include: { client: true } } },
    });
  }

  async create(actor: JwtPayload, dto: CreateGuardianDto) {
    if (dto.linkedClientId) {
      const linked = await this.prisma.client.findFirst({ where: { id: dto.linkedClientId, gymId: actor.gymId } });
      if (!linked) throw new NotFoundException('Клиент для привязки не найден');
    }
    const guardian = await this.prisma.guardian.create({
      data: {
        gymId: actor.gymId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
        relation: dto.relation,
        linkedClientId: dto.linkedClientId,
      },
    });
    await this.activityLog.log(actor, 'Добавил законного представителя', guardian.fullName, dto.relation);
    return guardian;
  }

  // Привязка ребёнка к представителю — идемпотентна: повторная привязка
  // того же (guardianId, clientId) не создаёт дубль (используется и когда
  // заводят второго ребёнка того же родителя, и когда у одного ребёнка
  // нужно указать второго представителя — оба сценария явно требует P0.6).
  async linkChild(actor: JwtPayload, guardianId: string, clientId: string) {
    const guardian = await this.findOne(actor, guardianId);
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');

    const link = await this.prisma.guardianChild.upsert({
      where: { guardianId_clientId: { guardianId, clientId } },
      create: { guardianId, clientId },
      update: {},
    });
    await this.activityLog.log(actor, 'Привязал законного представителя к клиенту', client.name, `${guardian.fullName} (${guardian.relation})`);
    return link;
  }

  async unlinkChild(actor: JwtPayload, guardianId: string, clientId: string) {
    const guardian = await this.findOne(actor, guardianId);
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    const remaining = await this.prisma.guardianChild.count({ where: { clientId } });
    if (remaining <= 1) {
      throw new BadRequestException('У несовершеннолетнего клиента должен остаться хотя бы один законный представитель');
    }
    await this.prisma.guardianChild.delete({ where: { guardianId_clientId: { guardianId, clientId } } });
    await this.activityLog.log(actor, 'Отвязал законного представителя от клиента', client.name, `${guardian.fullName} (${guardian.relation})`);
    return { ok: true };
  }
}
