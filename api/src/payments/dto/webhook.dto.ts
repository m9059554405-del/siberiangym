import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

// Вебхук эквайринга (P2.9): вызов от банка о судьбе платежа. Авторизация —
// статический токен в заголовке x-webhook-token (сравнение на нашей
// стороне), JWT здесь нет — источник не человек.
export class WebhookDto {
  @IsString()
  orderId!: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsIn(['succeeded', 'failed'])
  status!: 'succeeded' | 'failed';

  @IsNumber()
  amountRub!: number;
}
