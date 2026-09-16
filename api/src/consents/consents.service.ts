import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConsentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { buildConsentTexts, CONSENT_TEXTS_VERSION } from './consent-texts.const';
import type { JwtPayload } from '../auth/auth.service';

export interface ConsentStatus {
  type: ConsentType;
  granted: boolean;
  version: string | null;
  updatedAt: Date | null;
  required: boolean;
}

// Согласие на обработку персональных данных (152-ФЗ, P0.4). Журнал
// добавлений (ConsentRecord), а не редактируемая карточка — "дать" и
// "отозвать" каждое создают новую запись, текущий статус — последняя по
// времени запись для пары (clientId, type). Обязательные согласия
// проверяются гейтом на фронте при первом входе клиента; серверный guard
// на каждый бизнес-эндпоинт сознательно не заводился в этой версии — см.
// CHANGELOG, P0.4.
@Injectable()
export class ConsentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  private async resolveClient(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return client;
  }

  getTexts() {
    const texts = buildConsentTexts();
    return { version: CONSENT_TEXTS_VERSION, texts: Object.values(texts) };
  }

  private async statusForClient(gymId: string, clientId: string): Promise<ConsentStatus[]> {
    const texts = buildConsentTexts();
    const records = await this.prisma.consentRecord.findMany({
      where: { gymId, clientId },
      orderBy: { createdAt: 'desc' },
    });
    const latestByType = new Map<ConsentType, (typeof records)[number]>();
    for (const r of records) {
      if (!latestByType.has(r.type)) latestByType.set(r.type, r);
    }
    return (Object.keys(texts) as ConsentType[]).map((type) => {
      const latest = latestByType.get(type);
      return {
        type,
        granted: latest?.granted ?? false,
        version: latest?.version ?? null,
        updatedAt: latest?.createdAt ?? null,
        required: texts[type].required,
      };
    });
  }

  async getMyStatus(actor: JwtPayload) {
    const client = await this.resolveClient(actor);
    return this.statusForClient(actor.gymId, client.id);
  }

  // Для CEO/STAFF — аудит: подтверждение, что клиент подписал нужные формы
  // до начала тренировок, без необходимости лезть в базу руками.
  async getClientStatus(actor: JwtPayload, clientId: string) {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    return this.statusForClient(actor.gymId, clientId);
  }

  async grant(actor: JwtPayload, type: ConsentType, ip: string | undefined, userAgent: string | undefined) {
    const client = await this.resolveClient(actor);
    const record = await this.prisma.consentRecord.create({
      data: {
        gymId: actor.gymId,
        clientId: client.id,
        type,
        version: CONSENT_TEXTS_VERSION,
        granted: true,
        ipAddress: ip,
        userAgent,
      },
    });
    await this.activityLog.log(actor, 'Дал согласие на обработку данных', client.name, `${buildConsentTexts()[type].title} (версия ${CONSENT_TEXTS_VERSION})`);
    return record;
  }

  async revoke(actor: JwtPayload, type: ConsentType, ip: string | undefined, userAgent: string | undefined) {
    const client = await this.resolveClient(actor);
    const record = await this.prisma.consentRecord.create({
      data: {
        gymId: actor.gymId,
        clientId: client.id,
        type,
        version: CONSENT_TEXTS_VERSION,
        granted: false,
        ipAddress: ip,
        userAgent,
      },
    });
    await this.activityLog.log(actor, 'Отозвал согласие на обработку данных', client.name, buildConsentTexts()[type].title);
    return record;
  }

  // Право на выгрузку своих данных — весь объём, который относится к
  // клиенту, одним JSON-файлом.
  async exportData(actor: JwtPayload) {
    const client = await this.resolveClient(actor);
    const [full, consents, orders, transactions] = await Promise.all([
      this.prisma.client.findUnique({
        where: { id: client.id },
        include: {
          membership: true,
          formatHistory: true,
          program: { include: { days: { include: { entries: true } } } },
          workoutLogs: { include: { exercises: { include: { sets: true } } } },
          progressPhotos: true,
          measurements: true,
          cycleLogs: true,
          feedbackMessages: true,
          directorMessages: true,
        },
      }),
      this.prisma.consentRecord.findMany({ where: { clientId: client.id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.order.findMany({ where: { clientId: client.id }, include: { lines: true } }),
      this.prisma.transaction.findMany({ where: { clientId: client.id } }),
    ]);
    await this.activityLog.log(actor, 'Запросил выгрузку своих данных', client.name, '152-ФЗ, экспорт JSON');
    return { exportedAt: new Date().toISOString(), client: full, consents, orders, transactions };
  }

  // Удаление данных по запросу клиента — разводит явно, что удаляется, а
  // что помечается "хранится обезличенно" (P0.4 в бэклоге прямо
  // предупреждает: тихое удаление вообще всего по одной кнопке — баг,
  // который нарушит уже другой закон — обязательный срок хранения
  // финансовых документов).
  //
  // Удаляется: фото прогресса, замеры, женский календарь, телефон и email.
  // НЕ удаляется и не переименовывается: ФИО, сама карточка клиента,
  // абонементы, транзакции, заказы, чеки, журнал изменений — они обязаны
  // сохранять узнаваемую привязку к владельцу документа по требованиям
  // налогового/бухгалтерского учёта (как правило не менее 5 лет), и
  // исторические записи в activity-log (которые хранят имя как текст на
  // момент действия, а не ссылку) в принципе не могут быть отредактированы
  // задним числом — сам журнал по своей природе неизменяем.
  async requestDeletion(actor: JwtPayload, reason?: string) {
    const client = await this.resolveClient(actor);

    await this.prisma.$transaction([
      this.prisma.progressPhoto.deleteMany({ where: { clientId: client.id } }),
      this.prisma.measurement.deleteMany({ where: { clientId: client.id } }),
      this.prisma.cycleLog.deleteMany({ where: { clientId: client.id } }),
      this.prisma.client.update({ where: { id: client.id }, data: { profilePhotoUrl: null, phone: null, email: null } }),
      this.prisma.consentRecord.create({
        data: { gymId: actor.gymId, clientId: client.id, type: 'MARKETING_MEDIA', version: CONSENT_TEXTS_VERSION, granted: false },
      }),
      this.prisma.consentRecord.create({
        data: { gymId: actor.gymId, clientId: client.id, type: 'MARKETING_NEWSLETTER', version: CONSENT_TEXTS_VERSION, granted: false },
      }),
    ]);

    await this.activityLog.log(
      actor,
      'Запросил удаление персональных данных',
      client.name,
      `Удалены фото/замеры/женский календарь/контакты; абонементы, чеки и транзакции сохранены по требованиям учёта${reason ? ` — причина: ${reason}` : ''}`,
    );
    return { ok: true };
  }
}
