// Политика отмены и no-show (P2.5). Окно «поздней отмены» — сколько часов
// до начала ещё можно отказаться самостоятельно; значения — продуктовое
// решение клуба. P2.5 (хвост): окна вынесены в настройки окружения
// (LATE_CANCEL_WINDOW_PERSONAL_HOURS / LATE_CANCEL_WINDOW_GROUP_HOURS),
// дефолты — прежние продуктые решения: персональная тренировка платная и
// её поздняя отмена — прямая потеря времени тренера, поэтому окно
// большое; групповое занятие отпускаем почти до начала — освободившееся
// место подбирает лист ожидания (P2.3).
export function lateCancelWindowHours(kind: 'PERSONAL' | 'GROUP', env: NodeJS.ProcessEnv = process.env): number {
  const fallback = kind === 'PERSONAL' ? 12 : 2;
  const raw = kind === 'PERSONAL' ? env.LATE_CANCEL_WINDOW_PERSONAL_HOURS : env.LATE_CANCEL_WINDOW_GROUP_HOURS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

// Расписание хранит дату (UTC-полночь календарного дня) и время строкой
// "HH:MM" локального расписания — собираем из пары настоящий Date.
export function startsAt(date: Date, time: string): Date {
  return new Date(`${date.toISOString().slice(0, 10)}T${time}:00`);
}

export function hoursBefore(target: Date, now = new Date()): number {
  return (target.getTime() - now.getTime()) / 3_600_000;
}

// P2.12: как часто диспетчер серий поддерживает скользящий горизонт —
// добирает occurrence-занятия до series.horizonDays от сегодня. Точность
// тут не минутная (в отличие от напоминалок P2.4): серия опаздывать не
// может, занятие на дату создаётся заранее, поэтому редкий тик достаточен.
export const SERIES_TOPUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
