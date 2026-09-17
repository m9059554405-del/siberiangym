import { Module } from '@nestjs/common';
import { RefundsService } from './refunds.service';
import { RefundsController } from './refunds.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [ActivityLogModule, ScheduleModule],
  providers: [RefundsService],
  controllers: [RefundsController],
})
export class RefundsModule {}
