import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Уведомления клиента (P2.4): push/email/SMS-рассылка и журнал. Весь блок —
// про клиента (подписки, чтение); персонал уведомления не читает —
// триггеры уведомлений живут в orders/schedule и промоуте P2.3.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('vapid-public-key')
  async vapidPublicKey() {
    return { publicKey: await this.notifications.vapidPublicKey() };
  }

  @Post('subscribe')
  subscribe(@CurrentUser() user: JwtPayload, @Body() dto: SubscribePushDto) {
    return this.notifications.subscribe(user, dto);
  }

  @Get()
  listMine(@CurrentUser() user: JwtPayload) {
    return this.notifications.listMine(user);
  }

  @Post(':id/read')
  markRead(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notifications.markRead(user, id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user);
  }
}
