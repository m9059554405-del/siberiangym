import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateReportOfferDto } from './dto/report-offers.dto';
import type { JwtPayload } from '../auth/auth.service';

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'Всем клиентам', EXPIRING_SOON: 'Абонемент скоро истекает', TOP_PERFORMERS: 'Лидерам месяца',
};

@Injectable()
export class ReportOffersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  findAll(gymId: string) {
    return this.prisma.reportOffer.findMany({ where: { gymId }, orderBy: { createdAt: 'desc' } });
  }

  async create(actor: JwtPayload, dto: CreateReportOfferDto) {
    const offer = await this.prisma.reportOffer.create({ data: { gymId: actor.gymId, ...dto, active: true } });
    await this.activityLog.log(actor, 'Создал предложение для рассылки', dto.title, `Аудитория: ${AUDIENCE_LABEL[dto.audience]}`);
    return offer;
  }

  async toggleActive(actor: JwtPayload, id: string) {
    const before = await this.prisma.reportOffer.findFirst({ where: { id, gymId: actor.gymId } });
    if (!before) throw new NotFoundException('Предложение не найдено');
    const updated = await this.prisma.reportOffer.update({ where: { id }, data: { active: !before.active } });
    await this.activityLog.log(actor, before.active ? 'Выключил предложение' : 'Включил предложение', before.title, before.active ? 'Больше не попадёт в отчёты' : 'Снова попадает в отчёты');
    return updated;
  }

  async remove(actor: JwtPayload, id: string) {
    const before = await this.prisma.reportOffer.findFirst({ where: { id, gymId: actor.gymId } });
    if (!before) throw new NotFoundException('Предложение не найдено');
    await this.prisma.reportOffer.delete({ where: { id } });
    await this.activityLog.log(actor, 'Удалил предложение для рассылки', before.title, '—');
    return { ok: true };
  }
}
