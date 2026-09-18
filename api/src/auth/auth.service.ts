import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Role } from '@prisma/client';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp.util';

export interface JwtPayload {
  sub: string; // userId
  gymId: string;
  role: Role;
  // P3.8: версия сессии на момент выдачи токена. Отзыв = подъём версии
  // в User.sessionVersion: если в токене версия меньше актуальной из БД,
  // JwtStrategy отклоняет запрос (уволенный сотрудник, сменённый пароль,
  // выключенная 2FA — старые токены умирают сразу, не через 7 дней TTL).
  sesVer?: number;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new UnauthorizedException('Неверный email или пароль');
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Неверный email или пароль');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    if ((user.role === Role.CEO || user.role === Role.STAFF) && user.twoFactorEnabled && user.twoFactorSecret) {
      const challengeToken = this.jwt.sign({ sub: user.id, purpose: '2fa-login' }, { expiresIn: 300 });
      return { requiresTwoFactor: true, challengeToken };
    }
    return this.issueAccessToken(user);
  }

  private issueAccessToken(user: { id: string; gymId: string; role: Role; email: string | null; sessionVersion: number }) {
    const payload: JwtPayload = { sub: user.id, gymId: user.gymId, role: user.role, sesVer: user.sessionVersion };
    return {
      requiresTwoFactor: false,
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, role: user.role, gymId: user.gymId },
    };
  }

  async verifyTwoFactorLogin(challengeToken: string, code: string) {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwt.verify(challengeToken);
    } catch {
      throw new UnauthorizedException('Код подтверждения устарел — войдите снова');
    }
    if (payload.purpose !== '2fa-login' || !payload.sub) throw new UnauthorizedException('Недействительный запрос второго фактора');
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code)) {
      throw new UnauthorizedException('Неверный код подтверждения');
    }
    return this.issueAccessToken(user);
  }

  // P3.8: отзыв всех сессий пользователя — подъём sessionVersion. Старые
  // токены (sesVer меньше актуального) перестают проходить JwtStrategy.
  async revokeSessions(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
    if (!user) return;
    await this.prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  }

  async startTwoFactorSetup(actor: JwtPayload) {
    if (actor.role !== Role.CEO && actor.role !== Role.STAFF) throw new ForbiddenException('2FA доступна только CEO и STAFF');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.sub } });
    const secret = generateTotpSecret();
    await this.prisma.user.update({ where: { id: actor.sub }, data: { twoFactorPendingSecret: secret } });
    return { secret, otpauthUrl: otpauthUri(secret, user.email ?? actor.sub) };
  }

  async confirmTwoFactorSetup(actor: JwtPayload, code: string) {
    if (actor.role !== Role.CEO && actor.role !== Role.STAFF) throw new ForbiddenException('2FA доступна только CEO и STAFF');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.sub } });
    if (!user.twoFactorPendingSecret || !verifyTotp(user.twoFactorPendingSecret, code)) throw new BadRequestException('Неверный код приложения-аутентификатора');
    await this.prisma.user.update({ where: { id: actor.sub }, data: { twoFactorSecret: user.twoFactorPendingSecret, twoFactorPendingSecret: null, twoFactorEnabled: true } });
    return { enabled: true };
  }

  async disableTwoFactor(actor: JwtPayload, code: string) {
    if (actor.role !== Role.CEO && actor.role !== Role.STAFF) throw new ForbiddenException('2FA доступна только CEO и STAFF');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.sub } });
    if (!user.twoFactorEnabled || !user.twoFactorSecret || !verifyTotp(user.twoFactorSecret, code)) throw new BadRequestException('Неверный код приложения-аутентификатора');
    // Выключение 2FA — подозрительное действие: отзываем все сессии (P3.8),
    // кроме текущей (её и так выдаём заново через новый login).
    await this.prisma.user.update({ where: { id: actor.sub }, data: { twoFactorSecret: null, twoFactorPendingSecret: null, twoFactorEnabled: false, sessionVersion: { increment: 1 } } });
    return { enabled: false };
  }

  // P3.5: запрашивающий не получает подтверждения существования email —
  // одинаковый ответ защищает от перечисления аккаунтов. В БД хранится
  // только SHA-256 хэш случайного одноразового токена, исходный токен
  // отправляется по email и никогда не логируется.
  async requestPasswordReset(email: string): Promise<{ ok: true }> {
    const genericResponse = { ok: true } as const;
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !user.isActive || !user.email) return genericResponse;

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const ttlMinutes = this.config.get<number>('PASSWORD_RESET_TTL_MINUTES', 30);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } }),
    ]);

    const frontendUrl = this.config.get<string>('PUBLIC_APP_URL', '').replace(/\/$/, '');
    const resetUrl = `${frontendUrl}/#/reset-password?token=${encodeURIComponent(rawToken)}`;
    await this.email.send(
      user.email,
      'Сброс пароля — SiberianGym',
      `Здравствуйте!\n\nЧтобы задать новый пароль, откройте ссылку:\n${resetUrl}\n\nСсылка действует ${ttlMinutes} минут и одноразовая. Если вы не запрашивали сброс, просто проигнорируйте это письмо.\n\nSiberianGym`,
    );
    return genericResponse;
  }

  async resetPassword(rawToken: string, password: string): Promise<{ ok: true }> {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now() || !token.user.isActive) {
      throw new BadRequestException('Ссылка сброса недействительна или истекла');
    }

    const passwordHash = await this.hashPassword(password);
    await this.prisma.$transaction([
      // Смена пароля инвалидирует все ранее выданные токены (P3.8).
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } }),
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.passwordResetToken.updateMany({ where: { userId: token.userId, usedAt: null, id: { not: token.id } }, data: { usedAt: new Date() } }),
    ]);
    return { ok: true };
  }

  // Смена активной точки сети (P1.1) — CEO переключается между Gym одной
  // Network без повторного входа по паролю. Новый токен несёт другой
  // gymId, но того же sub/role — все существующие эндпоинты продолжают
  // работать без изменений, потому что везде читают gymId из токена
  // (JwtStrategy.validate просто возвращает payload как есть), а не из
  // базы: смена точки — это по сути смена "текущего контекста", а не
  // отдельная сессия.
  async switchGym(actor: JwtPayload, targetGymId: string) {
    if (actor.role !== Role.CEO) throw new ForbiddenException('Смена точки доступна только CEO');
    const currentGym = await this.prisma.gym.findUniqueOrThrow({ where: { id: actor.gymId }, select: { networkId: true } });
    const network = await this.prisma.network.findUnique({ where: { id: currentGym.networkId } });
    if (!network || network.ownerId !== actor.sub) {
      throw new ForbiddenException('Вы не являетесь владельцем сети');
    }
    const targetGym = await this.prisma.gym.findUnique({ where: { id: targetGymId } });
    if (!targetGym || targetGym.networkId !== network.id) {
      throw new NotFoundException('Точка не найдена в вашей сети');
    }
    const payload: JwtPayload = { sub: actor.sub, gymId: targetGym.id, role: actor.role };
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: actor.sub }, select: { email: true } });
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: actor.sub, email: user.email, role: actor.role, gymId: targetGym.id },
    };
  }

  async createUser(gymId: string, email: string, password: string, role: Role, phone?: string, name?: string) {
    const passwordHash = await this.hashPassword(password);
    // select без passwordHash — хэш пароля никогда не должен уходить в ответ API,
    // даже в захешированном виде.
    return this.prisma.user.create({
      data: { gymId, email, phone, name, passwordHash, role },
      select: { id: true, gymId: true, email: true, phone: true, name: true, role: true, isActive: true, createdAt: true },
    });
  }

  // Инструмент CEO «Завести администратора» (P1.10) — заводит STAFF сразу
  // с логином, одним действием (в отличие от тренера, у STAFF нет
  // отдельной карточки-сущности, которую нужно было бы создавать вторым
  // шагом). Роль всегда STAFF — сознательно не принимает role параметром:
  // CLIENT/TRAINER заводятся через свои профильные флоу (clients/trainers,
  // с собственной бизнес-карточкой), а создание ещё одного CEO через этот
  // инструмент не имеет смысла при текущей модели Network.ownerId (P1.1) —
  // новый CEO-пользователь не будет владеть никакой сетью и не сможет
  // пройти resolveOwnedNetworkId ни в одном сетевом эндпоинте.
  // gymId (управление точками) — опциональная точка сети, уже проверенная
  // контроллером на принадлежность сети владельца; без неё — как раньше,
  // текущая точка токена.
  async createStaff(actor: JwtPayload, dto: { name: string; email: string; password: string; phone?: string; gymId?: string }) {
    return this.createUser(dto.gymId ?? actor.gymId, dto.email, dto.password, Role.STAFF, dto.phone, dto.name);
  }
}
