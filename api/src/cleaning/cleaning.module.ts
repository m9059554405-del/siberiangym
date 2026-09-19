import { Module } from '@nestjs/common';
import { CleaningService } from './cleaning.service';
import { CleaningController, CleaningZonesController } from './cleaning.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [CleaningService],
  controllers: [CleaningController, CleaningZonesController],
})
export class CleaningModule {}
