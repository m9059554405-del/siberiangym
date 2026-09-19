import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GymsService } from '../gyms/gyms.service';
import { csvDocument } from './csv.util';
import type { JwtPayload } from '../auth/auth.service';

// Эндпоинт CEO-only, поэтому с P1.7 выручка отдаётся сразу по всей сети —
// сводка не требует раздельного захода в каждую точку. Точка приложена к
// каждой строке (gymId + имя) — по ней веб строит разбивку по точкам и
// фильтр «вся сеть / конкретная площадка».
@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gyms: GymsService,
  ) {}

  async findAll(actor: JwtPayload) {
    const gymIds = await this.gyms.resolveNetworkGymIds(actor);
    return this.prisma.transaction.findMany({
      where: { gymId: { in: gymIds } },
      include: { client: true, trainer: true, gym: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    });
  }

  // P4.3: выгрузка для бухгалтерии — CSV (';', BOM) по всей сети за период.
  // Каждая транзакция — отдельная строка: возвраты идут с отрицательной
  // суммой и своей категорией, так что месячная сверка сходится в ноль по
  // знаку без отдельных файлов. Формат плоский и машиночитаемый — 1С/Excel
  // забирают без ручной настройки.
  async exportCsv(actor: JwtPayload, from?: string, to?: string): Promise<string> {
    const gymIds = await this.gyms.resolveNetworkGymIds(actor);
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(`${to.slice(0, 10)}T23:59:59.999Z`) : undefined;
    const rows = await this.prisma.transaction.findMany({
      where: {
        gymId: { in: gymIds },
        ...(fromDate || toDate
          ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
          : {}),
      },
      include: { client: { select: { name: true } }, trainer: { select: { name: true } }, gym: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });

    const CATEGORY_LABEL: Record<string, string> = {
      MEMBERSHIP: 'Абонементы',
      PERSONAL: 'Персональные',
      GROUP: 'Групповые',
      ANCILLARY: 'Сопутствующие',
      REFUND: 'Возврат',
    };

    return csvDocument(
      ['Дата', 'Сумма, руб.', 'Категория', 'Клиент', 'Тренер', 'Описание', 'Точка'],
      rows.map((t) => [
        t.date.toISOString().slice(0, 19).replace('T', ' '),
        t.amount,
        CATEGORY_LABEL[t.category] ?? t.category,
        t.client?.name ?? '',
        t.trainer?.name ?? '',
        t.description,
        t.gym?.name ?? '',
      ]),
    );
  }
}
