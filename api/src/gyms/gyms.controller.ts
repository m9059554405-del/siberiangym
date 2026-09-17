import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GymsService } from './gyms.service';
import { CreateGymDto } from './dto/gym.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Управление точками своей сети (P1.1) — только владелец сети (CEO).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO)
@Controller('gyms')
export class GymsController {
  constructor(private readonly gyms: GymsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.gyms.listForNetwork(user);
  }

  @Post()
  create(@Body() dto: CreateGymDto, @CurrentUser() user: JwtPayload) {
    return this.gyms.create(user, dto);
  }
}
