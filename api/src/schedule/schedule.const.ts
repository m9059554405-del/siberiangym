// Политика отмены и no-show (P2.5). Окно «поздней отмены» — сколько часов
// до начала ещё можно отказаться самостоятельно; значения — продуктовое
// решение клуба, зафиксированное здесь. Персональная тренировка платная и
// её поздняя отмена — прямая потеря времени тренера (бэклог P2.5),
// поэтому окно большое; групповое занятие отпускаем почти до начала —
// освободившееся место подбирает лист ожидания (P2.3).
export const LATE_CANCEL_WINDOW_HOURS: Record<'PERSONAL' | 'GROUP', number> = {
  PERSONAL: 12,
  GROUP: 2,
};

// Расписание хранит дату (UTC-полночь календарного дня) и время строкой
// "HH:MM" локального расписания — собираем из пары настоящий Date.
export function startsAt(date: Date, time: string): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T${time}:00`);
}

export function hoursBefore(target: Date, now = new Date()): number {
  return (target.getTime() - now.getTime()) / 3_600_000;
}
