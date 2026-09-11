import { Tariff } from '@prisma/client';

// Цены тарифов сопровождения — перенесены как есть из демо-версии.
// TODO: со временем вынести в настройки зала (по образцу MembershipPricing),
// когда появится второй зал с другими ценами.
export const TARIFF_PRICE: Record<Tariff, number> = {
  BASIC: 2500,
  COACHING: 4900,
  INDIVIDUAL: 15900,
};

export const TARIFF_NAME: Record<Tariff, string> = {
  BASIC: 'Базовый',
  COACHING: 'Ведение',
  INDIVIDUAL: 'Индивидуальные тренировки',
};
