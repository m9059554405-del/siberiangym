import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { SwitchGymDto } from './dto/switch-gym.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { GymsService } from '../gyms/gyms.service';
import type { JwtPayload } from './auth.service';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly gyms: GymsService,
  ) {}

  @Throttle({ login: { limit: 5, ttl: 60, blockDuration: 300 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Throttle({ default: { limit: 3, ttl: 900, blockDuration: 900 } })
  @Post('request-password-reset')
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Throttle({ default: { limit: 5, ttl: 900, blockDuration: 900 } })
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  // Смена активной точки сети (P1.1) — CEO переключается между Gym одной Network.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CEO)
  @Post('switch-gym')
  switchGym(@Body() dto: SwitchGymDto, @CurrentUser() actor: JwtPayload) {
    return this.auth.switchGym(actor, dto.gymId);
  }

  // Инструмент CEO «Завести администратора» (P1.10) — по умолчанию в ту
  // точку сети, в которой сейчас активен токен CEO; с gymId — в любую
  // точку своей сети (проверка владения в GymsService, а не по параметру).
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CEO)
  @Post('staff')
  createStaff(@Body() dto: CreateStaffDto, @CurrentUser() actor: JwtPayload) {
    if (dto.gymId) {
      return this.gyms.assertBelongsToOwnedNetwork(actor, dto.gymId).then(() => this.auth.createStaff(actor, dto));
    }
    return this.auth.createStaff(actor, dto);
  }
}
