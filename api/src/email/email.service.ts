import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

// Уведомления на email — единственный канал на старте (без SMS, как решено
// в 0.1.0). Пока в .env не заданы SMTP_* переменные, сервис ничего не
// отправляет, а только пишет в лог — так фича не ломает деплой без
// настроенной почты и включается сама, как только появятся реквизиты SMTP.
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.from = this.config.get<string>('SMTP_FROM') ?? 'SiberianGym <no-reply@siberiangym.ru>';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP не настроен (SMTP_HOST/SMTP_USER/SMTP_PASS) — email-уведомления будут только логироваться');
    }
  }

  async send(to: string | null | undefined, subject: string, text: string): Promise<void> {
    if (!to) return;

    if (!this.transporter) {
      this.logger.log(`[email отключён] Кому: ${to} | Тема: ${subject} | ${text}`);
      return;
    }

    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text });
    } catch (err) {
      // Сбой отправки письма не должен ронять бизнес-операцию (оплату,
      // выдачу доступа и т.д.) — только логируем.
      this.logger.error(`Не удалось отправить письмо на ${to}: ${(err as Error).message}`);
    }
  }
}
