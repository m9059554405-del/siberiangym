import { Controller, Get, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Цены абонементов и услуг — читать может любая авторизованная роль
// (нужно клиенту в личном кабинете, тренеру, администратору и CEO).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get()
  get(@CurrentUser() user: JwtPayload) {
    return this.pricing.get(user.gymId);
  }
}
