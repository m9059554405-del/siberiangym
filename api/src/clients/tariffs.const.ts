import { Tariff } from '@prisma/client';

// Тарифы сопровождения. Виды тарифов (BASIC/COACHING/INDIVIDUAL) — это
// бизнес-правила (разблокировки функций в приложении), а вот цены с P4.2
// настраиваются точкой в MembershipPricing (escort_*) — раньше они были
// константой, перенесённой из демо-версии.
export const ESCORT_TARIFFS: Tariff[] = ['BASIC', 'COACHING', 'INDIVIDUAL'];

export const TARIFF_NAME: Record<Tariff, string> = {
  BASIC: 'Базовый',
  COACHING: 'Ведение',
  INDIVIDUAL: 'Индивидуальные тренировки',
};

// Колонка MembershipPricing с ценой этого тарифа.
export const ESCORT_PRICE_COLUMN: Record<Tariff, 'escortBasic' | 'escortCoaching' | 'escortIndividual'> = {
  BASIC: 'escortBasic',
  COACHING: 'escortCoaching',
  INDIVIDUAL: 'escortIndividual',
};
