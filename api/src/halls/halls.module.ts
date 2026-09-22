import { Module } from '@nestjs/common';
import { HallsController } from './halls.controller';
import { HallsService } from './halls.service';
import { GymsModule } from '../gyms/gyms.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [GymsModule, ActivityLogModule],
  controllers: [HallsController],
  providers: [HallsService],
})
export class HallsModule {}
