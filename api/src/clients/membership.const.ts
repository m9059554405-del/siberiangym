import { ClientFormat, MembershipType, Tariff } from '@prisma/client';

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
