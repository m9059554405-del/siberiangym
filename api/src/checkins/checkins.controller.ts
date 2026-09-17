import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CheckinSource, Role } from '@prisma/client';
import { CheckinsService } from './checkins.service';
import { ScanCheckinDto } from './dto/scan-checkin.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Контроль доступа на входе (P2.2): сканирование QR клиента и журнал
// проходов — только персонал своей точки (CEO — активная после
// switch-gym). Клиент проходы не сканирует и журнал не видит.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller('checkins')
export class CheckinsController {
  constructor(private readonly checkins: CheckinsService) {}

  @Post('scan')
  scan(@CurrentUser() user: JwtPayload, @Body() dto: ScanCheckinDto) {
    return this.checkins.scan(user, dto.code, dto.source ?? CheckinSource.QR);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.checkins.findAll(user);
  }
}
