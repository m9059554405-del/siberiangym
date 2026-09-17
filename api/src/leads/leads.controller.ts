import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Гостевые карточки (лиды) — инструмент персонала точки: завести гостя,
// отметить визит/потерю, зафиксировать конвертацию в клиента (P2.6).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.leads.list(user);
  }

  @Post()
  create(@Body() dto: CreateLeadDto, @CurrentUser() user: JwtPayload) {
    return this.leads.create(user, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeadDto, @CurrentUser() user: JwtPayload) {
    return this.leads.update(user, id, dto);
  }

  @Post(':id/convert')
  convert(@Param('id') id: string, @Body() dto: ConvertLeadDto, @CurrentUser() user: JwtPayload) {
    return this.leads.convert(user, id, dto.clientId);
  }
}
