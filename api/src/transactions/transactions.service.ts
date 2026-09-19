import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GymsService } from '../gyms/gyms.service';
import { csvDocument } from './csv.util';
import type { JwtPayload } from '../auth/auth.service';

// Эндпоинты CEO-only, поэтому с P1.7 данные отдаются сразу по всей сети —
// сводка не требует раздельного захода в каждую точку.
//
// P3.19: реестр и статистика разделены. Реестр — пагинированный
// (page/pageSize, фильтры trainerId/gymId), статистика — серверные
// SQL-агрегаты /transactions/summary: клиентская агрегация по полному
// списку больше не нужна, объём ответа не растёт с историей клуба, а
// цифры считаются по ВСЕМ строкам, а не по загруженной странице.
const CATEGORIES = ['MEMBERSHIP', 'PERSONAL', 'GROUP', 'ANCILLARY', 'REFUND'] as const;
type Category = (typeof CATEGORIES)[number];

export interface TransactionsFeed {
  items: Array<{
    id: string;
    date: Date;
    amount: number;
    category: string;
    clientId: string;
    trainerId: string | null;
    description: string;
    client?: { name: string } | null;
    trainer?: { name: string } | null;
    gym?: { id: string; name: string } | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
}

export interface RevenueSummary {
  total: number;
  byCategory: Record<Category, number>;
  byDay: Array<{ key: string } & Record<Category, number>>;
  byMonth: Array<{ key: string } & Record<Category, number>>;
  byGym: Array<{ gymId: string; name: string; total: number }>;
  byTrainer: Array<{ trainerId: string; name: string; avatarHue: number; revenue: number; payments: number }>;
}

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gyms: GymsService,
  ) {}

  // Запрошенные точки ∩ точки сети актора: фильтр из query не может
  // вытащить чужую сеть (P4.1), пустой gymId = вся сеть.
  private async scopedGymIds(actor: JwtPayload, requested?: string[]): Promise<string[]> {
    const networkIds = await this.gyms.resolveNetworkGymIds(actor);
    if (!requested || requested.length === 0) return networkIds;
    const set = new Set(requested);
    return networkIds.filter((id) => set.has(id));
  }

  async findAll(actor: JwtPayload, opts: { page?: string; pageSize?: string; trainerId?: string; gymId?: string[] }): Promise<TransactionsFeed> {
    const gymIds = await this.scopedGymIds(actor, opts.gymId);
    const page = Math.max(1, Math.floor(Number(opts.page) || 1));
    const requestedPageSize = Math.floor(Number(opts.pageSize));
    const pageSize = Math.min(200, Math.max(1, Number.isFinite(requestedPageSize) && requestedPageSize >= 1 ? requestedPageSize : 50));
    const where: Prisma.TransactionWhereInput = {
      gymId: { in: gymIds },
      ...(opts.trainerId ? { trainerId: opts.trainerId } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        include: { client: { select: { name: true } }, trainer: { select: { name: true } }, gym: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.transaction.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  // Серверная агрегация выручки (P3.19): один проход SQL по каждой оси
  // вместо выгрузки всей истории на клиент. Возвраты участвуют со знаком
  // минус в total и своей категорией; byDay — скользящее окно days.
  async summary(actor: JwtPayload, opts: { gymId?: string[]; days?: string }): Promise<RevenueSummary> {
    const gymIds = await this.scopedGymIds(actor, opts.gymId);
    const gyms = Prisma.join(gymIds);
    const days = Math.min(365, Math.max(1, Math.floor(Number(opts.days) || 30)));

    const categoryCols = CATEGORIES.map((c) => `COALESCE(SUM(amount) FILTER (WHERE category = '${c}'), 0)::int AS "${c}"`).join(', ');
    const pivot = (keyExpr: string, dateFilter: string) => `
      SELECT ${keyExpr} AS key, ${categoryCols}
      FROM transactions
      WHERE gym_id IN (${gyms})${dateFilter}
      GROUP BY 1 ORDER BY 1`;

    const [totalsRow] = await this.prisma.$queryRaw<{ total: number }[]>(
      Prisma.sql`SELECT COALESCE(SUM(amount), 0)::int AS total FROM transactions WHERE gym_id IN (${gyms})`,
    );
    const byCategoryRows = await this.prisma.$queryRaw<{ category: Category; total: number }[]>(
      Prisma.sql`SELECT category, COALESCE(SUM(amount), 0)::int AS total FROM transactions WHERE gym_id IN (${gyms}) GROUP BY 1`,
    );
    const byDayRows = await this.prisma.$queryRaw(
      Prisma.sql`SELECT to_char(date_trunc('day', date), 'YYYY-MM-DD') AS key, ${Prisma.raw(categoryCols)} FROM transactions WHERE gym_id IN (${gyms}) AND date >= now() - make_interval(days => ${days}::int) GROUP BY 1 ORDER BY 1`,
    );
    const byMonthRows = await this.prisma.$queryRaw(
      Prisma.sql`SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS key, ${Prisma.raw(categoryCols)} FROM transactions WHERE gym_id IN (${gyms}) GROUP BY 1 ORDER BY 1`,
    );
    const byGymRows = await this.prisma.$queryRaw<{ gymId: string; name: string; total: number }[]>(
      Prisma.sql`SELECT g.id AS "gymId", g.name, COALESCE(SUM(t.amount), 0)::int AS total FROM transactions t JOIN gyms g ON g.id = t.gym_id WHERE t.gym_id IN (${gyms}) GROUP BY 1, 2 ORDER BY 3 DESC`,
    );
    const byTrainerRows = await this.prisma.$queryRaw<{ trainerId: string; name: string; avatarHue: number; revenue: number; payments: number }[]>(
      Prisma.sql`SELECT tr.id AS "trainerId", tr.name, tr.avatar_hue AS "avatarHue", COALESCE(SUM(t.amount), 0)::int AS revenue, COUNT(*)::int AS payments FROM transactions t JOIN trainers tr ON tr.id = t.trainer_id WHERE t.gym_id IN (${gyms}) AND t.trainer_id IS NOT NULL GROUP BY 1, 2, 3 ORDER BY 4 DESC`,
    );

    const byCategory = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    for (const row of byCategoryRows) byCategory[row.category] = Number(row.total);

    const normalizePivot = (rows: Array<Record<string, unknown>>) =>
      rows.map((row) => {
        const point: { key: string } & Record<Category, number> = { key: String(row.key), ...Object.fromEntries(CATEGORIES.map((c) => [c, 0])) } as never;
        for (const c of CATEGORIES) point[c] = Number(row[c] ?? 0);
        return point;
      });

    return {
      total: Number(totalsRow?.total ?? 0),
      byCategory,
      byDay: normalizePivot(byDayRows as Array<Record<string, unknown>>),
      byMonth: normalizePivot(byMonthRows as Array<Record<string, unknown>>),
      byGym: byGymRows.map((r) => ({ gymId: r.gymId, name: r.name, total: Number(r.total) })),
      byTrainer: byTrainerRows.map((r) => ({ trainerId: r.trainerId, name: r.name, avatarHue: Number(r.avatarHue), revenue: Number(r.revenue), payments: Number(r.payments) })),
    };
  }

  // P4.3: выгрузка для бухгалтерии — CSV (';', BOM) по всей сети за период.
  // Каждая транзакция — отдельная строка: возвраты идут с отрицательной
  // суммой и своей категорией, так что месячная сверка сходится в ноль по
  // знаку без отдельных файлов. Формат плоский и машиночитаемый — 1С/Excel
  // забирают без ручной настройки.
  async exportCsv(actor: JwtPayload, from?: string, to?: string): Promise<string> {
    const gymIds = await this.scopedGymIds(actor);
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
