import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { TrainersModule } from '../trainers/trainers.module';

@Module({
  imports: [ActivityLogModule, TrainersModule],
  providers: [ScheduleService],
  controllers: [ScheduleController],
})
export class ScheduleModule {}
