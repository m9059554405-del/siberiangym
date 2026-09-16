import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CancelOrderDto, ConfirmReceiptDto, CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // Очередь незакрытых заказов на точке — админ видит их независимо от того,
  // кто именно из смены их собрал (P0.2: заказ не привязан намертво к автору).
  @Roles(Role.CEO, Role.STAFF)
  @Get('open')
  findOpen(@CurrentUser() user: JwtPayload) {
    return this.orders.findOpen(user.gymId);
  }

  @Roles(Role.CLIENT)
  @Get('mine')
  findOwn(@CurrentUser() user: JwtPayload) {
    return this.orders.findOwn(user);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.findOne(user, id);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: JwtPayload) {
    return this.orders.createOrder(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post(':id/pay/cash')
  submitCash(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.orders.submitCash(user, id);
  }

  // Сканирование чека — только администратор/CEO на ресепшене, у клиента
  // такого права нет (иначе он сам себе "подтвердит" любую оплату).
  @Roles(Role.CEO, Role.STAFF)
  @Post(':id/confirm-receipt')
  confirmReceipt(@Param('id') id: string, @Body() dto: ConfirmReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.orders.confirmReceipt(user, id, dto.qrRaw);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelOrderDto, @CurrentUser() user: JwtPayload) {
    return this.orders.cancelOrder(user, id, dto.reason);
  }
}
