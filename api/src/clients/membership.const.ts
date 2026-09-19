import { ClientFormat, MembershipStatus, MembershipType, Tariff } from '@prisma/client';
import { zonedLogicalDate } from '../common/club-timezone';

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
// Prisma читает и пишет колонки @db.Date как UTC-полночь. С P3.11
// календарный день определяется по ЧАСОВОМУ ПОЯСУ КЛУБА (CLUB_TIMEZONE,
// по умолчанию Asia/Novosibirsk), а не по локальному времени сервера:
// сервер в UTC «меняет день» в 00:00 UTC = 07:00 утра в Новосибирске, и
// без этого вечер клуба относился бы к «вчерашнему» дню (сдвиг сроков
// абонемента/заморозки на день). Подробности — common/club-timezone.ts.
export function startOfDay(d: Date): Date {
  return zonedLogicalDate(d);
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
