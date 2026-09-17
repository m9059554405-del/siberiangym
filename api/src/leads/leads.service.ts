import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import type { JwtPayload } from '../auth/auth.service';

// Гостевые карточки (лиды) — P2.6: воронка «пришёл узнать → попробовал →
// купил». Локальная сущность точки, как журнал проходов (P2.2): продажи
// ведёт персонал своей точки, сетевого списка лидов нет. Клиент в системе
// появляется обычной регистрацией с абонементом; конвертация только
// фиксирует связь лида с созданным клиентом.
@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService, private readonly activityLog: ActivityLogService) {}

  list(actor: JwtPayload) {
    return this.prisma.lead.findMany({
      where: { gymId: actor.gymId },
      include: { convertedClient: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getOwned(gymId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, gymId } });
    if (!lead) throw new NotFoundException('Карточка гостя не найдена');
    return lead;
  }

  async create(actor: JwtPayload, dto: CreateLeadDto) {
    const lead = await this.prisma.lead.create({
      data: {
        gymId: actor.gymId,
        name: dto.name.trim(),
        phone: dto.phone?.trim() || null,
        email: dto.email?.trim() || null,
        visitDate: dto.visitDate ? new Date(dto.visitDate) : new Date(),
        note: dto.note?.trim() || null,
      },
    });
    await this.activityLog.log(actor, 'Создал карточку гостя', lead.name, `визит ${lead.visitDate?.toISOString().slice(0, 10) ?? 'без даты'}`);
    return lead;
  }

  async update(actor: JwtPayload, id: string, dto: UpdateLeadDto) {
    const lead = await this.getOwned(actor.gymId, id);
    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}),
        ...(dto.email !== undefined ? { email: dto.email.trim() || null } : {}),
        ...(dto.visitDate !== undefined ? { visitDate: new Date(dto.visitDate) } : {}),
        ...(dto.note !== undefined ? { note: dto.note.trim() || null } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { convertedClient: { select: { id: true, name: true } } },
    });
    await this.activityLog.log(actor, 'Обновил карточку гостя', updated.name, dto.status ? `статус: ${dto.status}` : 'правка данных');
    return updated;
  }

  async convert(actor: JwtPayload, id: string, clientId: string) {
    const lead = await this.getOwned(actor.gymId, id);
    if (lead.status === 'CONVERTED') throw new ConflictException('Гость уже сконвертирован — карточка закрыта');
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден на этой точке');
    const updated = await this.prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'CONVERTED', convertedClientId: client.id, convertedAt: new Date() },
      include: { convertedClient: { select: { id: true, name: true } } },
    });
    await this.activityLog.log(actor, 'Конвертировал гостя в клиента', client.name, `из карточки гостя: ${lead.name}`);
    return updated;
  }
}
