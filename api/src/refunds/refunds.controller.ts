import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RefundsService } from './refunds.service';
import { ConfirmRefundReceiptDto, RequestRefundDto } from './dto/refund.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Возврат оплаты (P0.7) — доступно только CEO/STAFF: это операция на
// ресепшене с реальным фискальным документом, клиент её не инициирует сам.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller()
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}

  @Get('refunds/open')
  findOpen(@CurrentUser() user: JwtPayload) {
    return this.refunds.findOpen(user.gymId);
  }

  @Get('refunds/:id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.refunds.findOne(user, id);
  }

  @Post('orders/:orderId/refund')
  requestRefund(@Param('orderId') orderId: string, @Body() dto: RequestRefundDto, @CurrentUser() user: JwtPayload) {
    return this.refunds.requestRefund(user, orderId, dto.reason);
  }

  @Post('refunds/:id/confirm-receipt')
  confirmReceipt(@Param('id') id: string, @Body() dto: ConfirmRefundReceiptDto, @CurrentUser() user: JwtPayload) {
    return this.refunds.confirmReceipt(user, id, dto.qrRaw);
  }

  @Post('refunds/:id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.refunds.cancelRefund(user, id);
  }
}
