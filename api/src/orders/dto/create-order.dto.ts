import { Type } from 'class-transformer';
import { IsArray, IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { OrderLineType } from '@prisma/client';

// Тип строки заказа, который может явно задать вызывающая сторона (фронтенд).
// MEMBERSHIP_RENEWAL сюда намеренно не входит — сервер сам решает, покупка
// это или продление, в момент расчёта заказа (по факту наличия активного
// абонемента у клиента), чтобы фронтенду не нужно было знать эту бизнес-логику.
const CREATABLE_LINE_TYPES = [
  OrderLineType.MEMBERSHIP_PURCHASE,
  OrderLineType.TARIFF_CHANGE,
  OrderLineType.STOCK_PURCHASE,
  OrderLineType.LOCKER_RENTAL,
  OrderLineType.GROUP_CLASS_BOOKING,
  OrderLineType.PERSONAL_SLOT_BOOKING,
] as const;

export class OrderLineInputDto {
  @IsIn(CREATABLE_LINE_TYPES)
  type!: (typeof CREATABLE_LINE_TYPES)[number];

  // Смысл зависит от type: id тренера (TARIFF_CHANGE), id товара (STOCK_PURCHASE),
  // id шкафчика (LOCKER_RENTAL), id занятия/слота (GROUP_CLASS_BOOKING/PERSONAL_SLOT_BOOKING).
  @IsOptional()
  @IsString()
  refId?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}

export class CreateOrderDto {
  @IsString()
  clientId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineInputDto)
  lines!: OrderLineInputDto[];

  // P4.4: промокод (любая роль — персональный проверяется на владельца)
  // и корпоративная атрибуция (только STAFF/CEO, проверка в сервисе).
  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsString()
  corporateAccountId?: string;
}

export class ConfirmReceiptDto {
  @IsString()
  qrRaw!: string;
}

export class CancelOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
