import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ActivityLogModule, NotificationsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
