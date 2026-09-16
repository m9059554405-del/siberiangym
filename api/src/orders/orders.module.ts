import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
