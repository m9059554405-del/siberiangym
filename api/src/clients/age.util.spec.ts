import { calculateAge, isMinor } from './age.util';

// P3.1: возраст и статус несовершеннолетнего (P0.6) — граничные даты:
// день рождения, день перед ним и неуказанная дата рождения.

describe('calculateAge', () => {
  const asOf = new Date(2026, 8, 18); // 18.09.2026

  it('день рождения сегодня — возраст уже увеличился', () => {
    expect(calculateAge(new Date(2008, 8, 18), asOf)).toBe(18);
  });

  it('день рождения завтра — возраст ещё не увеличился', () => {
    expect(calculateAge(new Date(2008, 8, 19), asOf)).toBe(17);
  });

  it('день рождения прошёл раньше в этом году', () => {
    expect(calculateAge(new Date(2008, 0, 1), asOf)).toBe(18);
  });

  it('день рождения 29 февраля считается корректно в невисокосный год', () => {
    // 29.02.2008 родился; 18.09.2026 — полных 18 (день рождения в 2026
    // «наступил» 28.02/01.03, но не раньше 18.09 в любом случае).
    expect(calculateAge(new Date(2008, 1, 29), asOf)).toBe(18);
  });
});

describe('isMinor', () => {
  const asOf = new Date(2026, 8, 18);

  it('null-дата рождения — статус неизвестен', () => {
    expect(isMinor(null, 18, asOf)).toBeNull();
  });

  it('ровно в день 18-летия — уже не несовершеннолетний', () => {
    expect(isMinor(new Date(2008, 8, 18), 18, asOf)).toBe(false);
  });

  it('за день до 18-летия — несовершеннолетний', () => {
    expect(isMinor(new Date(2008, 8, 19), 18, asOf)).toBe(true);
  });

  it('порог зала настраивается (16 лет)', () => {
    expect(isMinor(new Date(2010, 8, 18), 16, asOf)).toBe(false);
    expect(isMinor(new Date(2010, 8, 19), 16, asOf)).toBe(true);
  });
});
