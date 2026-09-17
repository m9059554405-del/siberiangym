import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// SMS-шлюз (P2.4). Провайдера в проекте нет — поэтому зеркалит поведение
// EmailService: если в .env не заданы SMS_* (переменные условного
// провайдера), сообщения только логируются; интеграция с реальным
// шлюзом подставляется здесь, не трогая вызовы. SMS — фолбэк для
// критичных напоминаний (отмена/перенос), не для регулярных.
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = !!(this.config.get<string>('SMS_API_URL') && this.config.get<string>('SMS_API_KEY'));
    if (!this.enabled) {
      this.logger.warn('SMS-шлюз не настроен (SMS_API_URL/SMS_API_KEY) — SMS-уведомления будут только логироваться');
    }
  }

  async send(phone: string | null | undefined, text: string): Promise<void> {
    if (!phone) return;

    if (!this.enabled) {
      this.logger.log(`[sms отключён] Кому: ${phone} | ${text}`);
      return;
    }

    try {
      const url = this.config.get<string>('SMS_API_URL')!;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.get<string>('SMS_API_KEY')}` },
        body: JSON.stringify({ phone, text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      // Сбой SMS не должен ронять бизнес-операцию — только логируем
      // (как это делает EmailService с письмами).
      this.logger.error(`Не удалось отправить SMS на ${phone}: ${(err as Error).message}`);
    }
  }
}
