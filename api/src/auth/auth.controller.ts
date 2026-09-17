import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
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

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
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
