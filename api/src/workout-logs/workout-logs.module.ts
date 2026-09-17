import { Module } from '@nestjs/common';
import { WorkoutLogsService } from './workout-logs.service';
import { WorkoutLogsController } from './workout-logs.controller';
import { GymsModule } from '../gyms/gyms.module';

@Module({
  imports: [GymsModule],
  providers: [WorkoutLogsService],
  controllers: [WorkoutLogsController],
})
export class WorkoutLogsModule {}
