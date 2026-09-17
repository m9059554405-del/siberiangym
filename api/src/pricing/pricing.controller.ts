import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PricingService } from './pricing.service';
import { UpdatePricingDto } from './dto/update-pricing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Цены абонементов и услуг — читать может любая авторизованная роль
// (нужно клиенту в личном кабинете, тренеру, администратору и CEO),
// менять — только CEO (влияет на выручку всей точки).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.pricing.get(user.gymId);
  }

  @Roles(Role.CEO)
  @Patch()
  update(@Body() dto: UpdatePricingDto, @CurrentUser() user: JwtPayload) {
    return this.pricing.update(user, dto);
  }
}
