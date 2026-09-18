import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Возвращаемое значение попадает в request.user — именно его читают
  // декоратор @CurrentUser() и RolesGuard.
  //
  // P3.8: подпись токена больше не гарантирует актуальность доступа —
  // после увольнения/деактивации или смены пароля сервер поднимает
  // User.sessionVersion, и старые токены (с меньшей версией сессии)
  // отклоняются здесь же, не дожидаясь 7-дневного TTL.isActive тоже
  // проверяется на каждом запросе: деактивированный пользователь (P3.9)
  // теряет доступ немедленно.
  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { isActive: true, sessionVersion: true } });
    if (!user || !user.isActive) throw new UnauthorizedException('Учётная запись деактивирована — войдите снова');
    if (payload.sesVer === undefined || payload.sesVer < user.sessionVersion) {
      throw new UnauthorizedException('Сессия отозвана — войдите снова');
    }
    return payload;
  }
}
