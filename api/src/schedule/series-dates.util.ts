// P2.12/P3.1: чистая часть генератора серий — окно дат и дни недели,
// вынесена из ScheduleService, чтобы календарную математику горизонта можно
// было покрыть юнит-тестами без БД. Все даты — календарные дни UTC-полночь
// (как @db.Date в Prisma).

// Календарный день (UTC-полночь) из произвольного момента.
export function dayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Индекс дня недели календарного дня: 0=Пн ... 6=Вс — нумерация
// TrainerWorkHour.day, а не JS getDay() (воскресенье = 0).
export function weekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

// Даты-кандидаты серии в окне генерации: от max(startDate, сегодня) до
// min(сегодня + horizonDays, endDate) включительно, только дни недели из
// набора series.weekdays. Скользящий горизонт считается ОТ СЕГОДНЯ, а не от
// startDate — горизонт «на N недель вперёд» должен поддерживаться и через
// год жизни серии.
export function seriesWindowDates(params: {
  weekdays: number[];
  startDate: Date;
  endDate: Date | null;
  horizonDays: number;
  today?: Date;
}): Date[] {
  const today = dayUtc(params.today ?? new Date());
  const horizonEnd = new Date(today.getTime() + params.horizonDays * 86_400_000);
  const from = params.startDate > today ? params.startDate : today;
  const to = params.endDate && params.endDate < horizonEnd ? params.endDate : horizonEnd;
  if (from > to) return [];

  const weekdays = new Set(params.weekdays);
  const dates: Date[] = [];
  for (let day = new Date(from); day.getTime() <= to.getTime(); day = new Date(day.getTime() + 86_400_000)) {
    if (weekdays.has(weekdayIndex(day))) dates.push(day);
  }
  return dates;
}
