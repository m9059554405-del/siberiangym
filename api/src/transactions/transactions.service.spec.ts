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
    const prisma: any = { transaction: { findMany: jest.fn().mockResolvedValue(rows) } };
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
