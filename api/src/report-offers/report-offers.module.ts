import { Module } from '@nestjs/common';
import { ReportOffersService } from './report-offers.service';
import { ReportOffersController } from './report-offers.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [ReportOffersService],
  controllers: [ReportOffersController],
})
export class ReportOffersModule {}
