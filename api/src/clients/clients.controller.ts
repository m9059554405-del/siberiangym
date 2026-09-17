import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Roles(Role.CEO, Role.STAFF)
  @Get()
  findAll(@Query('network') network: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.clients.findAll(user, network === '1');
  }

  @Roles(Role.CLIENT)
  @Get('me')
  findMe(@CurrentUser() user: JwtPayload) {
    return this.clients.findMe(user);
  }

  // До ':id' — иначе роутер примет "network-search" за значение :id
  // (тот же класс бага, что уже чинили в guardians.controller, P0.6).
  @Roles(Role.CEO, Role.STAFF)
  @Get('network-search')
  networkSearch(@Query('q') q: string, @CurrentUser() user: JwtPayload) {
    return this.clients.networkSearch(user, q ?? '');
  }

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clients.findOneForActor(user, id);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser() user: JwtPayload) {
    return this.clients.create(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: JwtPayload) {
    return this.clients.update(user, id, dto);
  }

  // Выбор/смена тренера, смена тарифа и оформление/продление абонемента —
  // платные действия, с P0.2 идут через POST /orders (см. api/src/orders/),
  // а не через прямые эндпоинты здесь: старая логика сразу отмечала
  // "оплачено" без проверки, что чек вообще был пробит.

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post(':id/go-self-training')
  goSelfTraining(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clients.goSelfTraining(user, id);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post(':id/create-login')
  createLogin(@Param('id') id: string, @Body() dto: CreateLoginDto, @CurrentUser() user: JwtPayload) {
    return this.clients.createLogin(user, id, dto);
  }
}
