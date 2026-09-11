import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { HealthService } from './health.service';
import { AddCycleLogDto, AddMeasurementDto, AddProgressPhotoDto } from './dto/health.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Get('clients/:clientId/progress-photos')
  listProgressPhotos(@Param('clientId') clientId: string) {
    return this.health.listProgressPhotos(clientId);
  }

  @Roles(Role.CLIENT)
  @Post('progress-photos')
  addProgressPhoto(@Body() dto: AddProgressPhotoDto, @CurrentUser() user: JwtPayload) {
    return this.health.addProgressPhoto(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Get('clients/:clientId/measurements')
  listMeasurements(@Param('clientId') clientId: string) {
    return this.health.listMeasurements(clientId);
  }

  @Roles(Role.CLIENT)
  @Post('measurements')
  addMeasurement(@Body() dto: AddMeasurementDto, @CurrentUser() user: JwtPayload) {
    return this.health.addMeasurement(user, dto);
  }

  @Roles(Role.CLIENT)
  @Get('cycle-logs')
  listOwnCycleLogs(@CurrentUser() user: JwtPayload) {
    return this.health.listOwnCycleLogs(user);
  }

  @Roles(Role.CLIENT)
  @Post('cycle-logs')
  addCycleLog(@Body() dto: AddCycleLogDto, @CurrentUser() user: JwtPayload) {
    return this.health.addCycleLog(user, dto);
  }
}
