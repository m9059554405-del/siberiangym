import { ClientFormat, MembershipStatus, MembershipType, Tariff } from '@prisma/client';

// Общие для ClientsService и OrdersService константы абонементов — вынесены
// сюда, чтобы при обработке заказа (P0.2) и при прямом действии администратора
// не разошлись два независимых списка одного и того же смысла.
export const VALIDITY_DAYS: Record<MembershipType, number | null> = {
  SINGLE: null,
  MONTHLY: 30,
  PACK10: 90,
  PACK20: 120,
};

export const VISITS_TOTAL: Record<MembershipType, number | null> = {
  SINGLE: null,
  MONTHLY: null,
  PACK10: 10,
  PACK20: 20,
};

export const MEMBERSHIP_LABEL: Record<MembershipType, string> = {
  SINGLE: 'Разовое посещение',
  MONTHLY: 'Абонемент на месяц',
  PACK10: 'Абонемент на 10 занятий',
  PACK20: 'Абонемент на 20 занятий',
};

export function formatForTariff(tariff: Tariff | undefined | null): ClientFormat {
  if (!tariff) return ClientFormat.SELF;
  return tariff === Tariff.INDIVIDUAL ? ClientFormat.PERSONAL : ClientFormat.GROUP;
}

// Лимит дней заморозки на один оплаченный период абонемента (P2.1).
// «По тарифу» здесь — по типу абонемента: тариф сопровождения (BASIC/
// COACHING/INDIVIDUAL) — отдельная услуга и к сроку абонемента отношения
// не имеет. Разовое посещение срока действия не имеет — замораживать
// нечего. Значения — продуктовое решение клуба, зафиксировано здесь;
// при желании переезжает в MembershipPricing без смены логики.
export const FREEZE_LIMIT_DAYS: Record<MembershipType, number> = {
  SINGLE: 0,
  MONTHLY: 14,
  PACK10: 14,
  PACK20: 21,
};

// Верхняя граница одной заморозки — чтобы опечатка в поле «дней» не
// съела весь лимит разом; сам лимит всё равно проверяется отдельно.
export const FREEZE_MAX_DAYS_PER_REQUEST = 30;

// Все даты-без-времени здесь — «логические даты» в виде UTC-полуночи:
// Prisma читает и пишет колонки @db.Date как UTC-полуночь, поэтому
// локальная полночь (setHours) при записи усекалась бы в PostgreSQL
// на день раньше (для MSK — сдвиг на 3 часа назад) и разваливала
// сравнения с датами, приехавшими из БД. Берём календарный день из
// локального времени машины, но выражаем его полуночью UTC — тогда
// запись в @db.Date и round-trip через diffInDays работают одинаково.
export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000);
}

// Разница в полных сутках from → to (для дат без времени; отрицательная,
// если to раньше from).
export function diffInDays(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

// Эффективный статус абонемента с учётом «ленивой» разморозки (P2.1):
// планировщика в проекте нет, статус FROZEN сам не «оттает», поэтому все
// читатели статуса обязаны смотреть на дату окончания заморозки — если
// она уже прошла, абонемент фактически снова действует (ACTIVE).
export function effectiveMembershipStatus(m: { status: MembershipStatus; freezeEndsAt: Date | null }): MembershipStatus {
  if (m.status === 'FROZEN' && m.freezeEndsAt && diffInDays(m.freezeEndsAt, new Date()) >= 0) {
    return 'ACTIVE';
  }
  return m.status;
}
