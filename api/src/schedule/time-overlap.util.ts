// P2.7: расписание хранит интервалы парой «дата (UTC-полночь) + строки
// HH:MM локального расписания» — пересечение интервалов сравниваем по
// строкам времени в пределах одного календарного дня (занятия через
// полночь в клубной модели не существуют).
export interface TimeRange {
  date: Date;
  start: string;
  end: string;
}

export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.date.toISOString().slice(0, 10) === b.date.toISOString().slice(0, 10) && a.start < b.end && b.start < a.end;
}
