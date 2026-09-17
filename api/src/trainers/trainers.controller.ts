import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { TrainersService } from './trainers.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trainers')
export class TrainersController {
  constructor(private readonly trainers: TrainersService) {}

  // Список тренеров нужен всем ролям (клиент выбирает тренера, тренер видит коллег и т.д.)
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.trainers.findAll(user.gymId);
  }

  @Roles(Role.TRAINER)
  @Get('me')
  findMe(@CurrentUser() user: JwtPayload) {
    return this.trainers.findMe(user);
  }

  @Roles(Role.TRAINER)
  @Get('me/clients')
  findMyClients(@CurrentUser() user: JwtPayload) {
    return this.trainers.findMyClients(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.trainers.findOne(user.gymId, id);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post()
  create(@Body() dto: CreateTrainerDto, @CurrentUser() user: JwtPayload) {
    return this.trainers.create(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post(':id/create-login')
  createLogin(@Param('id') id: string, @Body() dto: CreateLoginDto, @CurrentUser() user: JwtPayload) {
    return this.trainers.createLogin(user, id, dto);
  }

  // Точки сети, на которых работает тренер (P1.3) — только CEO.
  @Roles(Role.CEO)
  @Get(':id/gyms')
  listGyms(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.trainers.listGyms(user, id);
  }

  @Roles(Role.CEO)
  @Post(':id/gyms')
  assignToGym(@Param('id') id: string, @Body('gymId') gymId: string, @CurrentUser() user: JwtPayload) {
    return this.trainers.assignToGym(user, id, gymId);
  }

  @Roles(Role.CEO)
  @Post(':id/gyms/:gymId/unassign')
  unassignFromGym(@Param('id') id: string, @Param('gymId') gymId: string, @CurrentUser() user: JwtPayload) {
    return this.trainers.unassignFromGym(user, id, gymId);
  }
}
