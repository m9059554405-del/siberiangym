import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, Prisma } from '@prisma/client';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import type { JwtPayload } from '../auth/auth.service';

// Как часто диспетчер напоминалок смотрит на расписание (P2.4). Окно
// напоминания ниже подобрано так, чтобы при минутном тике занятие/слот
// гарантированно попали в выборку ровно один раз.
const DISPATCH_INTERVAL_MS = 60_000;
const REMINDER_WINDOW_MIN = 55;
const REMINDER_WINDOW_MAX = 65;

// Каким каналами рассылать уведомление (P2.4): email у клиента есть
// почти всегда, push — только с подпиской, SMS — фолбэк для критичного.
const CHANNELS_BY_KIND: Record<string, NotificationChannel[]> = {
  BOOKING_CREATED: ['PUSH', 'EMAIL'],
  REMINDER_1H: ['PUSH', 'EMAIL'],
  // Отмена слота тренером/клиентом — «критичное» напоминание из бэклога:
  // SMS как fallback, если push-подписки нет.
  SLOT_CANCELLED: ['PUSH', 'EMAIL', 'SMS'],
  // Отмена группового занятия вместе с серией (P2.12) — тоже критичное:
  // клиент мог купить занятие заранее, деньги возвращаются вручную.
  GROUP_CLASS_CANCELLED: ['PUSH', 'EMAIL', 'SMS'],
  TRAINER_CHANGED: ['PUSH', 'EMAIL'],
};

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  // --- Настройки Web Push ---

  // VAPID-ключи живут singleton-строкой в app_settings: генерируются при
  // первом обращении (в .env их нет — см. комментарий к модели). Смена
  // ключей инвалидирует все подписки, поэтому генерируем строго один раз.
  private async vapidSettings() {
    const existing = await this.prisma.appSetting.findUnique({ where: { id: 'singleton' } });
    if (existing) return existing;
    const keys = webpush.generateVAPIDKeys();
    return this.prisma.appSetting.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', vapidPublicKey: keys.publicKey, vapidPrivateKey: keys.privateKey },
      update: {},
    });
  }

  async vapidPublicKey(): Promise<string> {
    return (await this.vapidSettings()).vapidPublicKey;
  }

  // --- Подписки и чтение (API) ---

  async subscribe(actor: JwtPayload, dto: { endpoint: string; p256dh: string; auth: string }) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new BadRequestException('У пользователя нет карточки клиента');
    // Идемпотентно: тот же endpoint от того же клиента — обновляем ключи,
    // от другого (браузер переустановил подписку) — забираем себе.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { clientId: client.id, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
      update: { clientId: client.id, p256dh: dto.p256dh, auth: dto.auth },
    });
    return { ok: true };
  }

  async listMine(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new BadRequestException('У пользователя нет карточки клиента');
    const [items, unread] = await this.prisma.$transaction([
      this.prisma.clientNotification.findMany({
        where: { clientId: client.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.clientNotification.count({ where: { clientId: client.id, readAt: null } }),
    ]);
    return { items, unread };
  }

  async markRead(actor: JwtPayload, id: string) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new BadRequestException('У пользователя нет карточки клиента');
    await this.prisma.clientNotification.updateMany({ where: { id, clientId: client.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  async markAllRead(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new BadRequestException('У пользователя нет карточки клиента');
    await this.prisma.clientNotification.updateMany({ where: { clientId: client.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  }

  // --- Рассылка ---

  // Создаёт уведомление и сразу рассылает по каналам своего типа.
  // Дубль (kind+refId+client) молча пропускается — диспетчер и ручные
  // триггеры могут сработать одновременно. Ни один канал не роняет
  // вызывающую бизнес-операцию.
  async notify(
    clientId: string,
    kind: string,
    title: string,
    body: string,
    refId?: string | null,
  ): Promise<void> {
    let created;
    try {
      created = await this.prisma.clientNotification.create({
        data: { clientId, kind, refId: refId ?? null, title, body, channels: CHANNELS_BY_KIND[kind] ?? ['PUSH', 'EMAIL'] },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return;
      throw err;
    }
    await this.deliver(created.id, clientId, kind, title, body);
  }

  private async deliver(id: string, clientId: string, kind: string, title: string, body: string) {
    const channels = CHANNELS_BY_KIND[kind] ?? ['PUSH', 'EMAIL'];
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return;

    if (channels.includes('PUSH')) {
      const subs = await this.prisma.pushSubscription.findMany({ where: { clientId } });
      if (subs.length > 0) {
        const settings = await this.vapidSettings();
        webpush.setVapidDetails(settings.vapidSubject, settings.vapidPublicKey, settings.vapidPrivateKey);
        for (const sub of subs) {
          try {
            await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title, body, tag: kind }));
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) {
              // Подписка умерла (браузер отозвал) — тихо удаляем.
              await this.prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
            } else {
              this.logger.warn(`Push на ${sub.endpoint.slice(0, 48)}… не доставлено: ${(err as Error).message}`);
            }
          }
        }
      }
    }
    if (channels.includes('EMAIL')) {
      await this.email.send(client.email, title, `Здравствуйте, ${client.name}!\n\n${body}\n\nSiberianGym`);
    }
    if (channels.includes('SMS')) {
      await this.sms.send(client.phone, `${title}. ${body}`);
    }

    await this.prisma.clientNotification.update({ where: { id }, data: { sentAt: new Date() } });
  }

  // --- Диспетчер напоминаний (P2.4) ---

  // Планировщика в проекте нет — лёгкий интервал прямо в API-процессе:
  // раз в минуту ищем занятия и слоты, начинающиеся через ~час, и
  // напоминаем каждому записанному. Идемпотентность обеспечивает
  // уникальность (kind, refId, clientId) в client_notifications.
  async runReminderTick() {
    const now = new Date();
    const from = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60_000);
    const to = new Date(now.getTime() + REMINDER_WINDOW_MAX * 60_000);

    const classes = await this.prisma.groupClass.findMany({
      where: {
        date: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())), lte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) },
      },
      include: { bookings: true },
    });
    // GroupClass.date — календарный день (UTC-полночь), время — строка
    // "HH:MM" локального расписания: собираем datetime прямо из пары.
    for (const gc of classes) {
      const startsAt = new Date(`${gc.date.toISOString().slice(0, 10)}T${gc.start}:00`);
      if (startsAt < from || startsAt > to) continue;
      for (const b of gc.bookings) {
        await this.notify(b.clientId, 'REMINDER_1H', 'Через час тренировка', `«${gc.type}» начинается в ${gc.start} (зона ${gc.zone}). Не забудьте!`, gc.id);
      }
    }

    const slots = await this.prisma.personalSlot.findMany({ where: { status: 'BOOKED', clientId: { not: null } } });
    for (const slot of slots) {
      const startsAt = new Date(`${slot.date.toISOString().slice(0, 10)}T${slot.start}:00`);
      if (startsAt < from || startsAt > to) continue;
      await this.notify(slot.clientId!, 'REMINDER_1H', 'Через час персональная тренировка', `Ваш слот начинается в ${slot.start}. Не забудьте!`, slot.id);
    }
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.runReminderTick().catch((err) => this.logger.error(`Тик диспетчера напоминаний упал: ${(err as Error).message}`));
    }, DISPATCH_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
}
