import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcquiringModule } from '../acquiring/acquiring.module';

@Module({
  imports: [ActivityLogModule, NotificationsModule, AcquiringModule],
  providers: [OrdersService],
  controllers: [OrdersController],
  exports: [OrdersService],
})
export class OrdersModule {}
