import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ChangeTariffDto, ChooseTrainerDto, PurchaseMembershipDto } from './dto/membership-actions.dto';
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
  findAll(@CurrentUser() user: JwtPayload) {
    return this.clients.findAll(user.gymId);
  }

  @Roles(Role.CLIENT)
  @Get('me')
  findMe(@CurrentUser() user: JwtPayload) {
    return this.clients.findMe(user);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clients.findOne(user.gymId, id);
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

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post(':id/choose-trainer')
  chooseTrainer(@Param('id') id: string, @Body() dto: ChooseTrainerDto, @CurrentUser() user: JwtPayload) {
    return this.clients.chooseTrainer(user, id, dto.trainerId, dto.tariff);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post(':id/change-tariff')
  changeTariff(@Param('id') id: string, @Body() dto: ChangeTariffDto, @CurrentUser() user: JwtPayload) {
    return this.clients.changeTariff(user, id, dto.tariff);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post(':id/go-self-training')
  goSelfTraining(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.clients.goSelfTraining(user, id);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post(':id/purchase-membership')
  purchaseMembership(@Param('id') id: string, @Body() dto: PurchaseMembershipDto, @CurrentUser() user: JwtPayload) {
    return this.clients.purchaseMembership(user, id, dto.type);
  }
}
