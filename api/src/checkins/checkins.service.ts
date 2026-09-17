import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CheckinSource, Membership } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GymsService } from '../gyms/gyms.service';
import { effectiveMembershipStatus } from '../clients/membership.const';
import type { JwtPayload } from '../auth/auth.service';

// Формат кода прохода (P2.2). Префикс нужен, чтобы отличить его от
// фискальных QR чеков (те начинаются с "t=", см. receipt-qr.util) —
// сканер на входе не должен пытаться «пропустить клиента» по чеку.
export const CHECKIN_CODE_PREFIX = 'sgym-checkin:';

// Дебаунс повторного скана (P2.2): клиент по ошибке сканирует QR дважды
// подряд за несколько секунд. Повторный скан того же клиента в течение
// окна после успешного прохода не создаёт вторую запись и не списывает
// второе посещение — возвращается уже существующий проход.
export const CHECKIN_DEBOUNCE_SECONDS = 60;

@Injectable()
export class CheckinsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gyms: GymsService,
  ) {}

  async scan(actor: JwtPayload, code: string, source: CheckinSource) {
    const raw = code.trim();
    if (!raw.startsWith(CHECKIN_CODE_PREFIX)) {
      throw new BadRequestException('Это не код прохода клуба — отсканируйте QR из приложения клиента («Мой QR») или введите код вручную');
    }
    const clientId = raw.slice(CHECKIN_CODE_PREFIX.length).trim();
    if (!clientId) throw new BadRequestException('Код прохода пустой');

    // Клиент ищется по всей сети (P1.5): на входе точки может оказаться
    // клиент любой точки — решает не то, где заведена карточка, а то,
    // покрывает ли абонемент эту точку (scope ниже).
    const networkId = await this.gyms.resolveNetworkId(actor);
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, gym: { networkId } },
      include: { membership: true, gym: { select: { id: true, name: true } } },
    });
    if (!client) throw new NotFoundException('Клиент с таким кодом не найден в сети клуба');

    const last = await this.prisma.checkinEntry.findFirst({
      where: { clientId: client.id, at: { gt: new Date(Date.now() - CHECKIN_DEBOUNCE_SECONDS * 1000) } },
      orderBy: { at: 'desc' },
    });
    if (last) {
      return { duplicate: true, checkin: last, client: this.present(client, client.membership) };
    }

    const m = client.membership;
    if (!m) throw new BadRequestException(`У «${client.name}» нет абонемента — оформите абонемент или разовое посещение`);
    const status = effectiveMembershipStatus(m);
    if (status === 'FROZEN') {
      throw new BadRequestException(`Абонемент «${client.name}» заморожен до ${m.freezeEndsAt!.toISOString().slice(0, 10)} — проход запрещён`);
    }
    if (status !== 'ACTIVE') {
      throw new BadRequestException(`Абонемент «${client.name}» не действует (срок истёк) — проход запрещён`);
    }
    if (m.scope === 'SINGLE_GYM' && client.gymId !== actor.gymId) {
      throw new BadRequestException(`Абонемент «${client.name}» действует только на своей точке (${client.gym.name}) — для входа здесь нужен сетевой абонемент`);
    }

    // Пакетные абонементы и разовое посещение списывают визит на проход
    // (в проекте это первое и единственное место списания visitsLeft);
    // месячный срок ограничен датой, визиты у него не считаются.
    const visitBased = m.visitsTotal !== null;
    const visitsLeft = visitBased ? m.visitsLeft ?? 0 : null;
    if (visitBased && visitsLeft! <= 0) {
      throw new BadRequestException(`Посещения по абонементу «${client.name}» закончились — проход запрещён`);
    }

    // Списание с условием в updateMany — защита от гонки двух сканов:
    // второй запрос не найдёт строку с visitsLeft > 0 и откажет.
    const checkin = await this.prisma.$transaction(async (tx) => {
      if (visitBased) {
        const res = await tx.membership.updateMany({ where: { id: m.id, visitsLeft: { gt: 0 } }, data: { visitsLeft: { decrement: 1 } } });
        if (res.count === 0) throw new BadRequestException(`Посещения по абонементу «${client.name}» только что закончились — проход запрещён`);
      }
      return tx.checkinEntry.create({ data: { gymId: actor.gymId, clientId: client.id, source } });
    });

    return {
      duplicate: false,
      checkin,
      client: this.present(client, m, visitBased ? visitsLeft! - 1 : null),
    };
  }

  // Журнал проходов своей точки: последние 100, свежие сверху. Проходы
  // в activity-log не дублируются (см. комментарий к модели CheckinEntry).
  findAll(actor: JwtPayload) {
    return this.prisma.checkinEntry.findMany({
      where: { gymId: actor.gymId },
      orderBy: { at: 'desc' },
      take: 100,
      include: { client: { select: { id: true, name: true } } },
    });
  }

  private present(client: { id: string; name: string; gym: { name: string } }, m: Membership | null, visitsLeftOverride?: number | null) {
    return {
      id: client.id,
      name: client.name,
      homeGymName: client.gym.name,
      membership: m
        ? {
            type: m.type,
            status: effectiveMembershipStatus(m),
            expiresAt: m.expiresAt,
            visitsLeft: visitsLeftOverride !== undefined ? visitsLeftOverride : m.visitsLeft,
          }
        : null,
    };
  }
}
