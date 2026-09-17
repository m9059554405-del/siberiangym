import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [PricingService],
  controllers: [PricingController],
})
export class PricingModule {}
