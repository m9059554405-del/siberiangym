import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { ScheduleController } from './schedule.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { TrainersModule } from '../trainers/trainers.module';
import { GymsModule } from '../gyms/gyms.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [ActivityLogModule, TrainersModule, GymsModule, EmailModule],
  providers: [ScheduleService],
  controllers: [ScheduleController],
  exports: [ScheduleService],
})
export class ScheduleModule {}
