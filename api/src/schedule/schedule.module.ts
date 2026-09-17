import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { TrainersModule } from '../trainers/trainers.module';
import { GymsModule } from '../gyms/gyms.module';

@Module({
  imports: [ActivityLogModule, TrainersModule, GymsModule],
  providers: [ScheduleService],
  controllers: [ScheduleController],
})
export class ScheduleModule {}
