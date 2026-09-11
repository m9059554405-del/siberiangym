import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { EquipmentService } from './equipment.service';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { CompleteServiceDto } from './dto/complete-service.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.equipment.findAll(user.gymId);
  }

  @Post()
  create(@Body() dto: CreateEquipmentDto, @CurrentUser() user: JwtPayload) {
    return this.equipment.create(user, dto);
  }

  @Post(':id/complete-service')
  completeService(@Param('id') id: string, @Body() dto: CompleteServiceDto, @CurrentUser() user: JwtPayload) {
    return this.equipment.completeService(user, id, dto);
  }
}
