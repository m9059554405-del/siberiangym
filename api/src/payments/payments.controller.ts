import { Body, Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { WebhookDto } from './dto/webhook.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// Обработчик платежей эквайринга (P2.9). Класс без общего гварда:
// вебхук банка публичный (авторизация по токену в заголовке), остальные
// методы — за JWT.
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // Публичный вызов банка: статус платежа. Токен проверяется сервисом.
  @Post('webhook')
  webhook(@Headers('x-webhook-token') token: string | undefined, @Body() dto: WebhookDto) {
    return this.payments.handleWebhook(token, dto);
  }

  // Показывать ли клиенту кнопку «Оплатить картой онлайн» (P2.9): кнопка
  // не видна, пока эквайринг не настроен через переменные окружения.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Get('online-enabled')
  onlineEnabled() {
    return { enabled: this.payments.onlineEnabled() };
  }
}
