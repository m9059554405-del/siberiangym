import { Module } from '@nestjs/common';
import { WorkoutLogsService } from './workout-logs.service';
import { WorkoutLogsController } from './workout-logs.controller';

@Module({
  providers: [WorkoutLogsService],
  controllers: [WorkoutLogsController],
})
export class WorkoutLogsModule {}
