import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { LockersService } from './lockers.service';
import { DoorStateDto } from './dto/door-state.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lockers')
export class LockersController {
  constructor(private readonly lockers: LockersService) {}

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.lockers.findAll(user.gymId);
  }

  // Терминал-киоск (P2.8): вызывается физическим терминалом при скане QR
  // клиента. Терминал авторизован JWT персонала точки. Роуты kiosk/*
  // объявлены ДО параметрического ':id/release', иначе Nest сматчит
  // 'kiosk' как :id и kiosk/release не существует.
  @Roles(Role.CEO, Role.STAFF)
  @Post('kiosk/scan')
  kioskScan(@Body('code') code: string, @CurrentUser() user: JwtPayload) {
    return this.lockers.kioskScan(user, code);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post('kiosk/release')
  kioskRelease(@Body('code') code: string, @CurrentUser() user: JwtPayload) {
    return this.lockers.kioskRelease(user, code);
  }

  // Колбэк контроллера замков о состоянии дверцы (P2.8).
  @Roles(Role.CEO, Role.STAFF)
  @Post('kiosk/door-state')
  doorState(@Body() dto: DoorStateDto, @CurrentUser() user: JwtPayload) {
    return this.lockers.doorState(user, dto.controllerId, dto.channel, dto.state);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post(':id/release')
  release(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.lockers.release(user, id);
  }
}
