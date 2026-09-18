import { Injectable, Logger } from '@nestjs/common';

// Провод эквайринга (P2.9). Абстракция над банком-эквайером (по плану
// клуба — Альфа-Банк): настройка тремя переменными окружения
// ACQUIRING_API_URL / ACQUIRING_API_KEY / ACQUIRING_WEBHOOK_TOKEN.
// В демо-среде провайдера нет — тот же приём, что у email/SMS-шлюзов:
// «настроенный» сервис выдаёт синтетический paymentUrl без обращения к
// банку, успех платежа симулируется вебхуком POST /payments/webhook.
// Реальная интеграция заменяет тело createPayment/verifyWebhookToken,
// остальной код (заказы, применение позиций) не меняется.
@Injectable()
export class AcquiringService {
  private readonly logger = new Logger('Acquiring');
  private readonly apiUrl = process.env.ACQUIRING_API_URL;
  private readonly apiKey = process.env.ACQUIRING_API_KEY;
  private readonly webhookToken = process.env.ACQUIRING_WEBHOOK_TOKEN;

  isConfigured(): boolean {
    return !!this.apiUrl && !!this.apiKey && !!this.webhookToken;
  }

  verifyWebhookToken(header: string | undefined): boolean {
    return this.isConfigured() && !!header && header === this.webhookToken;
  }

  // В реальной интеграции — регистрация платежа у банка (bindId у Альфы)
  // и URL платёжной формы. Демо-режим: URL синтетический, деньги не
  // списываются, успех приносит тестовый вебхук.
  createPayment(order: { id: string; totalAmount: number }): { paymentId: string; paymentUrl: string } {
    const paymentId = `acq_${order.id}`;
    const paymentUrl = `${this.apiUrl}?order=${encodeURIComponent(order.id)}&paymentId=${paymentId}&amount=${order.totalAmount}`;
    this.logger.log(`Платёж ${paymentId} на ${order.totalAmount} ₽ (демо-режим: без обращения к банку)`);
    return { paymentId, paymentUrl };
  }
}
