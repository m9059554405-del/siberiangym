// P3.11: клуб работает в конкретном часовом поясе (SiberianGym —
// Азия/Новосибирск, UTC+7), а сервер и Postgres — в UTC. Все даты-без-
// времени в системе — «логические» UTC-полуночи (@db.Date в Prisma), и
// единственный правильный способ получить «сегодня» — взять календарный
// день текущего момента В ЗОНЕ КЛУБА, а не UTC-день сервера: без этого
// между 17:00 и 24:00 UTC (вечер в Новосибирске) «сегодня» в системе —
// всё ещё «вчера», и абонемент истекает/замораживается на день раньше
// ожиданий клиента.
//
// Зона задаётся CLUB_TIMEZONE (по умолчанию Asia/Novosibirsk). Сейчас сеть
// работает в одной зоне; при появлении точек в разных зонах зона
// переезжает на уровень Gym — вычисление здесь останется тем же.

export const CLUB_TIMEZONE = process.env.CLUB_TIMEZONE ?? 'Asia/Novosibirsk';

// Логическая дата (UTC-полночь) календарного дня, которому принадлежит
// момент instant в timeZone. Реализация через Intl — без внешних пакетов
// и без ручной арифметики переходов на летнее время.
export function zonedLogicalDate(instant: Date = new Date(), timeZone: string = CLUB_TIMEZONE): Date {
  // en-CA даёт ISO-подобный YYYY-MM-DD
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  return new Date(`${iso}T00:00:00.000Z`);
}
