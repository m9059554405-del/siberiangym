import { zonedLogicalDate } from './club-timezone';

// P3.11: «сегодня» — календарный день текущего момента В ЗОНЕ КЛУБА
// (Asia/Novosibirsk, UTC+7), выраженный UTC-полночью. Критическая граница:
// 17:00 UTC = полночь следующего дня в Новосибирске.

describe('zonedLogicalDate', () => {
  it('день до 17:00 UTC — тот же календарный день', () => {
    expect(zonedLogicalDate(new Date('2026-09-18T05:00:00Z')).toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  it('16:59:59 UTC — ещё вчера по клубу, 17:00:00 UTC — уже завтра', () => {
    expect(zonedLogicalDate(new Date('2026-09-18T16:59:59Z')).toISOString()).toBe('2026-09-18T00:00:00.000Z');
    expect(zonedLogicalDate(new Date('2026-09-18T17:00:00Z')).toISOString()).toBe('2026-09-19T00:00:00.000Z');
  });

  it('23:30 UTC — следующий день по клубу', () => {
    expect(zonedLogicalDate(new Date('2026-09-18T23:30:00Z')).toISOString()).toBe('2026-09-19T00:00:00.000Z');
  });

  it('явная зона UTC — прежнее поведение UTC-дня', () => {
    expect(zonedLogicalDate(new Date('2026-09-18T23:30:00Z'), 'UTC').toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  it('граница месяца/года проходит корректно (31.12 → 01.01)', () => {
    expect(zonedLogicalDate(new Date('2026-12-31T20:00:00Z')).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
