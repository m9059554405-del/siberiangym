import { lateCancelWindowHours } from './schedule.const';

// P2.5 (хвост): окна поздней отмены настраиваются окружением
// (LATE_CANCEL_WINDOW_PERSONAL_HOURS / LATE_CANCEL_WINDOW_GROUP_HOURS),
// дефолты — прежние продуктовые решения 12/2.

describe('lateCancelWindowHours', () => {
  it('дефолты: персональная 12 ч, групповая 2 ч', () => {
    expect(lateCancelWindowHours('PERSONAL', {})).toBe(12);
    expect(lateCancelWindowHours('GROUP', {})).toBe(6 / 3);
  });

  it('значения из окружения применяются независимо для каждого вида', () => {
    expect(lateCancelWindowHours('PERSONAL', { LATE_CANCEL_WINDOW_PERSONAL_HOURS: '24' })).toBe(24);
    expect(lateCancelWindowHours('GROUP', { LATE_CANCEL_WINDOW_GROUP_HOURS: '6' })).toBe(6);
  });

  it('мусорные значения игнорируются — работает дефолт, а не NaN', () => {
    expect(lateCancelWindowHours('PERSONAL', { LATE_CANCEL_WINDOW_PERSONAL_HOURS: 'abc' })).toBe(12);
    expect(lateCancelWindowHours('GROUP', { LATE_CANCEL_WINDOW_GROUP_HOURS: '-5' })).toBe(2);
  });
});
