import { MembershipStatus } from '@prisma/client';
import { addDays, diffInDays, effectiveMembershipStatus, formatForTariff, startOfDay } from './membership.const';

// P3.1: календарная математика абонементов (P2.1 заморозка, P0.2 сроки
// действия) — все даты «логические», UTC-полночь, как @db.Date в Prisma.

describe('startOfDay / addDays / diffInDays', () => {
  it('startUtcDay даёт UTC-полночь календарного дня локального времени', () => {
    const d = startOfDay(new Date(2026, 8, 14, 18, 45)); // 14.09.2026 18:45 локально
    expect(d.toISOString()).toBe('2026-09-14T00:00:00.000Z');
    expect(d.getUTCHours()).toBe(0);
  });

  it('diffInDays считает полные сутки через границу месяца', () => {
    expect(diffInDays(new Date(Date.UTC(2026, 8, 14)), new Date(Date.UTC(2026, 9, 14)))).toBe(30);
  });

  it('diffInDays отрицательный для обратного направления', () => {
    expect(diffInDays(new Date(Date.UTC(2026, 9, 14)), new Date(Date.UTC(2026, 8, 14)))).toBe(-30);
  });

  it('diffInDays игнорирует время внутри суток', () => {
    expect(diffInDays(new Date(2026, 8, 14, 23, 59), new Date(2026, 8, 15, 0, 1))).toBe(1);
  });

  it('addDays переходит через високосный февраль 2028', () => {
    const d = addDays(new Date(Date.UTC(2028, 1, 27)), 3);
    expect(d.toISOString().slice(0, 10)).toBe('2028-03-01');
  });
});

describe('effectiveMembershipStatus (ленивая разморозка P2.1)', () => {
  const frozen = (freezeEndsAt: Date | null): { status: MembershipStatus; freezeEndsAt: Date | null } => ({
    status: 'FROZEN',
    freezeEndsAt,
  });

  it('FROZEN с будущей датой окончания заморозки остаётся FROZEN', () => {
    expect(effectiveMembershipStatus(frozen(new Date(Date.now() + 86_400_000)))).toBe('FROZEN');
  });

  it('FROZEN с прошедшей датой окончания фактически снова ACTIVE', () => {
    expect(effectiveMembershipStatus(frozen(new Date(Date.now() - 86_400_000)))).toBe('ACTIVE');
  });

  it('FROZEN с сегодняшним днём окончания — ACTIVE (freezeEndsAt — первый день действия)', () => {
    expect(effectiveMembershipStatus(frozen(new Date()))).toBe('ACTIVE');
  });

  it('FROZEN без даты окончания остаётся FROZEN', () => {
    expect(effectiveMembershipStatus(frozen(null))).toBe('FROZEN');
  });

  it('ACTIVE не пересчитывается', () => {
    expect(effectiveMembershipStatus({ status: 'ACTIVE', freezeEndsAt: null })).toBe('ACTIVE');
  });
});

describe('formatForTariff', () => {
  it('INDIVIDUAL — персональный формат', () => {
    expect(formatForTariff('INDIVIDUAL')).toBe('PERSONAL');
  });

  it('BASIC и COACHING — групповой формат', () => {
    expect(formatForTariff('BASIC')).toBe('GROUP');
    expect(formatForTariff('COACHING')).toBe('GROUP');
  });

  it('без тарифа — самостоятельные тренировки', () => {
    expect(formatForTariff(null)).toBe('SELF');
    expect(formatForTariff(undefined)).toBe('SELF');
  });
});
