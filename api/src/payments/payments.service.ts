import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { AcquiringService } from '../acquiring/acquiring.service';

// Вебхук эквайринга (P2.9): банк сообщает судьбу онлайн-платежа. Успех
// закрывает заказ тем же финалом, что и скан чека (позиции применяются,
// заказ PAID); провал — отменяет заказ, клиент собирает новый. Повторный
// вызов идемпотентен на стороне OrdersService.
@Injectable()
export class PaymentsService {
  constructor(
    private readonly orders: OrdersService,
    private readonly acquiring: AcquiringService,
  ) {}

  onlineEnabled(): boolean {
    return this.acquiring.isConfigured();
  }

  handleWebhook(tokenHeader: string | undefined, dto: { orderId: string; paymentId?: string; status: 'succeeded' | 'failed'; amountRub: number }) {
    if (!this.acquiring.verifyWebhookToken(tokenHeader)) {
      throw new ForbiddenException('Неверный токен вебхука эквайринга');
    }
    if (dto.status === 'succeeded') {
      return this.orders.confirmOnlinePayment(dto.orderId, dto.amountRub, JSON.stringify(dto));
    }
    return this.orders.cancelOnlinePayment(dto.orderId, `Онлайн-оплата не прошла${dto.paymentId ? ` (платёж ${dto.paymentId})` : ''}`);
  }
}
