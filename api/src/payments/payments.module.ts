import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { OrdersModule } from '../orders/orders.module';
import { AcquiringModule } from '../acquiring/acquiring.module';

@Module({
  imports: [OrdersModule, AcquiringModule],
  providers: [PaymentsService],
  controllers: [PaymentsController],
})
export class PaymentsModule {}
