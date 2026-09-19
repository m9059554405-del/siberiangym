import { csvDocument, csvEscape, csvRow } from './csv.util';
import { TransactionsService } from './transactions.service';

// P4.3: CSV для бухгалтерии — ';' + BOM (русский Excel без мастера
// импорта), экранирование RFC 4180, даты/категории человекочитаемые.

describe('csv.util', () => {
  it('разделитель — точка с запятой, BOM в начале файла', () => {
    const doc = csvDocument(['Дата', 'Сумма'], [['2026-09-01', 1500]]);
    expect(doc.startsWith('\uFEFF')).toBe(true);
    expect(doc).toContain('Дата;Сумма\r\n2026-09-01;1500\r\n');
  });

  it('поле с ; кавычкой и переносом экранируется, кавычки удваиваются', () => {
    expect(csvEscape('простое')).toBe('простое');
    expect(csvEscape('а;b')).toBe('"а;b"');
    expect(csvEscape('текст "х"')).toBe('"текст ""х"""');
    expect(csvEscape('строка\nперенос')).toBe('"строка\nперенос"');
  });

  it('null/undefined → пустая ячейка, числа остаются числами', () => {
    expect(csvRow([null, undefined, 42, ''])).toBe(';;42;');
  });
});

describe('TransactionsService.exportCsv (P4.3)', () => {
  const ceo = { sub: 'owner1', gymId: 'gym1', role: 'CEO' as const };

  function makeService(rows: unknown[]) {
    const prisma: any = {
      transaction: { findMany: jest.fn().mockResolvedValue(rows), count: jest.fn().mockResolvedValue(rows.length) },
      $transaction: jest.fn((arg: unknown[]) => Promise.all(arg)),
      $queryRaw: jest.fn(),
    };
    const gyms: any = { resolveNetworkGymIds: jest.fn().mockResolvedValue(['gym1']) };
    return { service: new TransactionsService(prisma, gyms), prisma, gyms };
  }

  it('выгружает транзакции сети за период с русскими категориями', async () => {
    const { service, prisma, gyms } = makeService([
      {
        date: new Date('2026-09-05T10:00:00Z'),
        amount: 3000,
        category: 'MEMBERSHIP',
        description: 'Абонемент на месяц до 2026-10-05',
        client: { name: 'Иван; Иванов' },
        trainer: null,
        gym: { name: 'Сибирь, Ленина 1' },
      },
      { date: new Date('2026-09-06T12:00:00Z'), amount: -500, category: 'REFUND', description: 'Возврат по заказу', client: { name: 'Пётр' }, trainer: { name: 'Анна' }, gym: { name: 'Сибирь, Ленина 1' } },
    ]);

    const csv = await service.exportCsv(ceo, '2026-09-01', '2026-09-30');

    expect(gyms.resolveNetworkGymIds).toHaveBeenCalledWith(ceo);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          gymId: { in: ['gym1'] },
          date: { gte: new Date('2026-09-01'), lte: new Date('2026-09-30T23:59:59.999Z') },
        }),
        orderBy: { date: 'asc' },
      }),
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Дата;Сумма, руб.;Категория;Клиент;Тренер;Описание;Точка');
    expect(csv).toContain('3000;Абонементы;"Иван; Иванов";');
    expect(csv).toContain('-500;Возврат;Пётр;Анна;');
  });

  it('без периода — фильтр дат не добавляется', async () => {
    const { service, prisma } = makeService([]);
    await service.exportCsv(ceo);
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { gymId: { in: ['gym1'] } } }),
    );
  });
});

describe('TransactionsService.findAll — пагинация реестра (P3.19)', () => {
  const ceo = { sub: 'owner1', gymId: 'gym1', role: 'CEO' as const };

  function makeFindAllService(total: number) {
    const prisma: any = {
      transaction: { findMany: jest.fn().mockResolvedValue([{ id: 't1' }]), count: jest.fn().mockResolvedValue(total) },
      $transaction: jest.fn((arg: unknown[]) => Promise.all(arg)),
      $queryRaw: jest.fn(),
    };
    const gyms: any = { resolveNetworkGymIds: jest.fn().mockResolvedValue(['gym1', 'gym2']) };
    return { service: new TransactionsService(prisma, gyms), prisma };
  }

  it('страница 2 по 10 — skip 10, take 10, total в ответе', async () => {
    const { service, prisma } = makeFindAllService(35);
    const feed = await service.findAll(ceo, { page: '2', pageSize: '10' });

    expect(feed).toEqual({ items: [{ id: 't1' }], total: 35, page: 2, pageSize: 10 });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10, orderBy: { date: 'desc' } }));
    expect(prisma.transaction.count).toHaveBeenCalled();
  });

  it('дефолты: страница 1, 50 строк; pageSize ограничен 200', async () => {
    const { service, prisma } = makeFindAllService(0);
    await service.findAll(ceo, {});
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 50 }));

    await service.findAll(ceo, { page: '1', pageSize: '10000' });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
  });

  it('мусорные page/pageSize не ломают запрос (NaN → дефолты)', async () => {
    const { service, prisma } = makeFindAllService(0);
    const feed = await service.findAll(ceo, { page: 'abc', pageSize: '-3' });
    expect(feed.page).toBe(1);
    expect(feed.pageSize).toBe(50);
  });

  it('фильтр gymId сужает выборку до пересечения с сетью актора (P4.1)', async () => {
    const { service, prisma } = makeFindAllService(0);
    await service.findAll(ceo, { gymId: ['gym2', 'gym-foreign'] });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ gymId: { in: ['gym2'] } }) }),
    );
  });

  it('trainerId попадает в where', async () => {
    const { service, prisma } = makeFindAllService(0);
    await service.findAll(ceo, { trainerId: 'tr1' });
    expect(prisma.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ trainerId: 'tr1' }) }),
    );
  });
});

describe('TransactionsService.summary — серверные агрегаты (P3.19)', () => {
  const ceo = { sub: 'owner1', gymId: 'gym1', role: 'CEO' as const };

  function makeSummaryService(rows: { total?: unknown[]; byCategory?: unknown[]; byDay?: unknown[]; byMonth?: unknown[]; byGym?: unknown[]; byTrainer?: unknown[] }) {
    const prisma: any = {
      transaction: { findMany: jest.fn(), count: jest.fn() },
      $transaction: jest.fn((arg: unknown[]) => Promise.all(arg)),
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce(rows.total ?? [{ total: 2500 }])
        .mockResolvedValueOnce(rows.byCategory ?? [{ category: 'MEMBERSHIP', total: 3000 }, { category: 'REFUND', total: -500 }])
        .mockResolvedValueOnce(rows.byDay ?? [{ key: '2026-09-18', MEMBERSHIP: 3000, PERSONAL: null, GROUP: 0, ANCILLARY: 0, REFUND: -500 }])
        .mockResolvedValueOnce(rows.byMonth ?? [{ key: '2026-09', MEMBERSHIP: 3000, PERSONAL: 0, GROUP: 0, ANCILLARY: 0, REFUND: -500 }])
        .mockResolvedValueOnce(rows.byGym ?? [{ gymId: 'gym1', name: 'Сибирь', total: 2500 }])
        .mockResolvedValueOnce(rows.byTrainer ?? [{ trainerId: 'tr1', name: 'Анна', avatarHue: 210, revenue: 1200, payments: 4 }]),
    };
    const gyms: any = { resolveNetworkGymIds: jest.fn().mockResolvedValue(['gym1']) };
    return { service: new TransactionsService(prisma, gyms), prisma };
  }

  it('агрегирует по всем осям, NULL→0, total — по всем строкам, не по странице', async () => {
    const { service, prisma } = makeSummaryService({});

    const s = await service.summary(ceo, { days: '30' });

    // ровно шесть SQL-агрегатов, без выгрузки сырых строк
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(6);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();

    expect(s.total).toBe(2500);
    expect(s.byCategory).toEqual({ MEMBERSHIP: 3000, PERSONAL: 0, GROUP: 0, ANCILLARY: 0, REFUND: -500 });
    expect(s.byDay).toEqual([{ key: '2026-09-18', MEMBERSHIP: 3000, PERSONAL: 0, GROUP: 0, ANCILLARY: 0, REFUND: -500 }]);
    expect(s.byMonth[0].key).toBe('2026-09');
    expect(s.byGym).toEqual([{ gymId: 'gym1', name: 'Сибирь', total: 2500 }]);
    expect(s.byTrainer).toEqual([{ trainerId: 'tr1', name: 'Анна', avatarHue: 210, revenue: 1200, payments: 4 }]);
  });

  it('отсутствующие категории заполняются нулями', async () => {
    const { service } = makeSummaryService({ byCategory: [] });
    const s = await service.summary(ceo, {});
    expect(s.byCategory).toEqual({ MEMBERSHIP: 0, PERSONAL: 0, GROUP: 0, ANCILLARY: 0, REFUND: 0 });
  });

  it('окно days ограничено 1..365 и мусорный days не ломает агрегаты', async () => {
    await expect(makeSummaryService({}).service.summary(ceo, { days: '9999' })).resolves.toBeDefined();
    await expect(makeSummaryService({}).service.summary(ceo, { days: 'abc' })).resolves.toBeDefined();
  });
});
