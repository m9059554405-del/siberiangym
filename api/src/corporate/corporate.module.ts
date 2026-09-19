import { Module } from '@nestjs/common';
import { CorporateController } from './corporate.controller';
import { CorporateService } from './corporate.service';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  controllers: [CorporateController],
  providers: [CorporateService],
  exports: [CorporateService],
})
export class CorporateModule {}
