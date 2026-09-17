import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GymsService } from './gyms.service';
import { CreateGymDto, MoveStaffDto, UpdateGymDto } from './dto/gym.dto';
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

  // Литеральные маршруты объявлены выше параметрических, чтобы ':id'
  // не перехватил 'staff'.
  @Get('staff')
  listStaff(@CurrentUser() user: JwtPayload) {
    return this.gyms.listStaff(user);
  }

  @Patch('staff/:userId')
  moveStaff(@Param('userId') userId: string, @Body() dto: MoveStaffDto, @CurrentUser() user: JwtPayload) {
    return this.gyms.moveStaff(user, userId, dto.gymId);
  }

  @Post()
  create(@Body() dto: CreateGymDto, @CurrentUser() user: JwtPayload) {
    return this.gyms.create(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGymDto, @CurrentUser() user: JwtPayload) {
    return this.gyms.update(user, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.gyms.remove(user, id);
  }
}
