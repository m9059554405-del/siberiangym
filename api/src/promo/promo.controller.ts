import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PromoService } from './promo.service';
import { CreatePromoCodeDto } from './dto/promo.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Управление промокодами точки (P4.4): создают и гасят на ресепшене
// (STAFF) и владелец (CEO); удаление использованного кода — только CEO,
// и то с отказом, если по коду уже есть заказы (см. сервис).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.CEO)
@Controller('promo-codes')
export class PromoController {
  constructor(private readonly promo: PromoService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.promo.list(user.gymId);
  }

  @Post()
  create(@Body() dto: CreatePromoCodeDto, @CurrentUser() user: JwtPayload) {
    return this.promo.create(user, dto);
  }

  @Post(':id/deactivate')
  deactivate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.promo.setActive(user, id, false);
  }

  @Post(':id/activate')
  activate(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.promo.setActive(user, id, true);
  }

  @Roles(Role.CEO)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.promo.remove(user, id);
  }
}
