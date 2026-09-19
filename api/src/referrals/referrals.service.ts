import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Client } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ApplyReferralDto, UpdateReferralSettingsDto } from './dto/referral.dto';
import type { JwtPayload } from '../auth/auth.service';

// Алфавит без легко путаемых символов (0/O, 1/I/L) — код диктуется по
// телефону и вводится руками, ошибки чтения дороже энтропии.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// Реферальная программа «приведи друга» (P4.4): клиент делится своим кодом,
// новичок активирует его один раз — обе стороны получают по персональному
// одноразовому промокоду со скидкой на следующий заказ.
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  private generateCode(length: number) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
  }

  // Код клиента выдаётся лениво при первом обращении к реферальному API —
  // колонка nullable, старые клиенты (и сиды) получили коды бэкфиллом
  // миграции P4.4, новые получают его здесь.
  private async ensureClientCode(client: Client): Promise<Client> {
    if (client.referralCode) return client;
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = this.generateCode(8);
      try {
        return await this.prisma.client.update({ where: { id: client.id }, data: { referralCode: code } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw new ConflictException('Не удалось сгенерировать реферальный код — попробуйте ещё раз');
  }

  // Строка настроек одна на зал, создаётся лениво с дефолтами (10%/10%).
  async getSettings(gymId: string) {
    const existing = await this.prisma.referralSettings.findUnique({ where: { gymId } });
    if (existing) return existing;
    try {
      return await this.prisma.referralSettings.create({ data: { gymId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return this.prisma.referralSettings.findUniqueOrThrow({ where: { gymId } });
      }
      throw err;
    }
  }

  async updateSettings(actor: JwtPayload, dto: UpdateReferralSettingsDto) {
    const current = await this.getSettings(actor.gymId);
    const updated = await this.prisma.referralSettings.update({
      where: { gymId: actor.gymId },
      data: {
        enabled: dto.enabled ?? current.enabled,
        referrerPercent: dto.referrerPercent ?? current.referrerPercent,
        referredPercent: dto.referredPercent ?? current.referredPercent,
      },
    });
    await this.activityLog.log(
      actor,
      'Обновил настройки реферальной программы',
      '',
      `программа ${updated.enabled ? 'включена' : 'выключена'}, скидки ${updated.referrerPercent}% / ${updated.referredPercent}%`,
    );
    return updated;
  }

  // Личный кабинет клиента: свой код, доступные бонусы, приведённые друзья.
  async me(actor: JwtPayload) {
    const client = await this.prisma.client.findFirst({ where: { userId: actor.sub, gymId: actor.gymId } });
    if (!client) throw new NotFoundException('Клиент не найден');
    const withCode = await this.ensureClientCode(client);
    const [settings, rewards, referrals] = await Promise.all([
      this.prisma.referralSettings.findUnique({ where: { gymId: actor.gymId } }),
      this.prisma.promoCode.findMany({
        where: { clientId: client.id, gymId: actor.gymId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.referral.findMany({
        where: { referrerId: client.id },
        include: { referred: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      referralCode: withCode.referralCode,
      enabled: settings?.enabled ?? true,
      referrerPercent: settings?.referrerPercent ?? 10,
      referredPercent: settings?.referredPercent ?? 10,
      rewards: rewards.map((r) => ({
        id: r.id,
        code: r.code,
        title: r.title,
        percentOff: r.percentOff,
        amountOff: r.amountOff,
        validUntil: r.validUntil,
        isActive: r.isActive,
        // null = не ограничен; для реферальных бонусов всегда 1 или 0
        remaining: r.maxUses > 0 ? Math.max(0, r.maxUses - r.usedCount) : null,
      })),
      referrals: referrals.map((ref) => ({ id: ref.id, name: ref.referred.name, createdAt: ref.createdAt })),
    };
  }

  private async createRewardPromo(
    tx: Prisma.TransactionClient,
    gymId: string,
    clientId: string,
    percentOff: number,
    title: string,
  ) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = `REF-${this.generateCode(6)}`;
      try {
        return await tx.promoCode.create({ data: { gymId, code, title, percentOff, maxUses: 1, clientId } });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') continue;
        throw err;
      }
    }
    throw new ConflictException('Не удалось сгенерировать код бонуса — попробуйте ещё раз');
  }

  // Активация чужого кода: один раз за жизнь клиента, не свой код,
  // программа включена. Бонусы создаются в одной транзакции со связкой —
  // не бывает «рефералка записана, а промокоды не выдались».
  async apply(actor: JwtPayload, dto: ApplyReferralDto) {
    const me = await this.prisma.client.findFirst({ where: { userId: actor.sub, gymId: actor.gymId } });
    if (!me) throw new NotFoundException('Клиент не найден');
    const settings = await this.getSettings(actor.gymId);
    if (!settings.enabled) throw new BadRequestException('Реферальная программа сейчас отключена');

    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Укажите реферальный код');
    const referrer = await this.prisma.client.findFirst({ where: { gymId: actor.gymId, referralCode: code } });
    if (!referrer) throw new NotFoundException('Реферальный код не найден');
    if (referrer.id === me.id) throw new BadRequestException('Нельзя активировать собственный код');
    const existing = await this.prisma.referral.findUnique({ where: { referredId: me.id } });
    if (existing) throw new ConflictException('Вы уже активировали реферальный код — бонус выдаётся один раз');

    const result = await this.prisma.$transaction(async (tx) => {
      try {
        const referral = await tx.referral.create({ data: { gymId: actor.gymId, referrerId: referrer.id, referredId: me.id } });
        const referrerPromo = await this.createRewardPromo(tx, actor.gymId, referrer.id, settings.referrerPercent, 'Реферальный бонус за приглашённого друга');
        const referredPromo = await this.createRewardPromo(tx, actor.gymId, me.id, settings.referredPercent, 'Реферальный бонус: скидка за приглашение');
        return { referral, rewards: [referrerPromo, referredPromo] };
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          throw new ConflictException('Вы уже активировали реферальный код — бонус выдаётся один раз');
        }
        throw err;
      }
    });
    await this.activityLog.log(actor, 'Активировал реферальный код', referrer.name, `скидки ${settings.referrerPercent}% / ${settings.referredPercent}%`);
    return result;
  }
}
