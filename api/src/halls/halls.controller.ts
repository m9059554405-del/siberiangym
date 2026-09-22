import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { HallsService } from './halls.service';
import { CreateHallDto, UpdateHallDto } from './dto/hall.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Управление залами точек сети (заявка клуба) — только владелец сети.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO)
@Controller('halls')
export class HallsController {
  constructor(private readonly halls: HallsService) {}

  @Get()
  list(@Query('gymId') gymId: string, @CurrentUser() user: JwtPayload) {
    return this.halls.list(user, gymId);
  }

  @Post()
  create(@Body() dto: CreateHallDto, @CurrentUser() user: JwtPayload) {
    return this.halls.create(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHallDto, @CurrentUser() user: JwtPayload) {
    return this.halls.update(user, id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.halls.remove(user, id);
  }
}
