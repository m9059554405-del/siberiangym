import { dayUtc, seriesWindowDates, weekdayIndex } from './series-dates.util';

// P3.1: окно дат генератора серий (P2.12) — скользящий горизонт от сегодня,
// clamp по endDate, нумерация дней недели 0=Пн … 6=Вс. Фиксируем «сегодня»,
// чтобы тест не зависел от даты запуска: 18.09.2026 — пятница.

const TODAY = new Date('2026-09-18T10:30:00.000Z'); // пятница

describe('dayUtc / weekdayIndex', () => {
  it('dayUtc отбрасывает время, оставляя UTC-полночь', () => {
    expect(dayUtc(TODAY).toISOString()).toBe('2026-09-18T00:00:00.000Z');
  });

  it('понедельник — 0, воскресенье — 6', () => {
    expect(weekdayIndex(new Date('2026-09-21T00:00:00.000Z'))).toBe(0); // Пн
    expect(weekdayIndex(new Date('2026-09-23T00:00:00.000Z'))).toBe(2); // Ср
    expect(weekdayIndex(new Date('2026-09-26T00:00:00.000Z'))).toBe(5); // Сб
    expect(weekdayIndex(new Date('2026-09-27T00:00:00.000Z'))).toBe(6); // Вс
  });
});

describe('seriesWindowDates', () => {
  function dates(iso: string[]) {
    return iso.map((d) => new Date(`${d}T00:00:00.000Z`));
  }

  it('скользящий горизонт от сегодня, только заданные дни недели', () => {
    // Пн+Чт, старт в прошлом, горизонт 14 дней (до 02.10 включительно)
    const result = seriesWindowDates({
      weekdays: [0, 3],
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: null,
      horizonDays: 14,
      today: TODAY,
    });
    expect(result).toEqual(dates(['2026-09-21', '2026-09-24', '2026-09-28', '2026-10-01']));
  });

  it('сегодня включается, если это день недели серии', () => {
    const result = seriesWindowDates({ weekdays: [4], startDate: new Date('2026-09-01T00:00:00.000Z'), endDate: null, horizonDays: 7, today: TODAY });
    expect(result).toEqual(dates(['2026-09-18', '2026-09-25']));
  });

  it('endDate срезает окно раньше горизонта', () => {
    const result = seriesWindowDates({
      weekdays: [0, 3],
      startDate: new Date('2026-09-01T00:00:00.000Z'),
      endDate: new Date('2026-09-25T00:00:00.000Z'),
      horizonDays: 14,
      today: TODAY,
    });
    expect(result).toEqual(dates(['2026-09-21', '2026-09-24']));
  });

  it('старт серии в будущем сдвигает начало окна', () => {
    const result = seriesWindowDates({
      weekdays: [4],
      startDate: new Date('2026-09-25T00:00:00.000Z'),
      endDate: null,
      horizonDays: 14,
      today: TODAY,
    });
    expect(result).toEqual(dates(['2026-09-25', '2026-10-02']));
  });

  it('просроченная серия (endDate в прошлом) — пусто', () => {
    const result = seriesWindowDates({
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: new Date('2026-08-01T00:00:00.000Z'),
      endDate: new Date('2026-09-10T00:00:00.000Z'),
      horizonDays: 14,
      today: TODAY,
    });
    expect(result).toEqual([]);
  });

  it('горизонт считается от сегодня, а не от старта серии', () => {
    // Старт давно, горизонт 0 дней с "завтрашним" сегодня → только завтра
    const result = seriesWindowDates({
      weekdays: [5],
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: null,
      horizonDays: 8,
      today: TODAY,
    });
    // субботы в окне до 26.09 включительно: 19.09 и 26.09
    expect(result).toEqual(dates(['2026-09-19', '2026-09-26']));
  });
});
