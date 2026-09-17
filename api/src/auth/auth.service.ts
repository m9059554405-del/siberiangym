import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string; // userId
  gymId: string;
  role: Role;
}

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
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
    const payload: JwtPayload = { sub: user.id, gymId: user.gymId, role: user.role };
    return {
      accessToken: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, role: user.role, gymId: user.gymId },
    };
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

  async createUser(gymId: string, email: string, password: string, role: Role, phone?: string) {
    const passwordHash = await this.hashPassword(password);
    // select без passwordHash — хэш пароля никогда не должен уходить в ответ API,
    // даже в захешированном виде.
    return this.prisma.user.create({
      data: { gymId, email, phone, passwordHash, role },
      select: { id: true, gymId: true, email: true, phone: true, role: true, isActive: true, createdAt: true },
    });
  }
}
