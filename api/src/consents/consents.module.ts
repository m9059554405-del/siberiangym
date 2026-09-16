import { Module } from '@nestjs/common';
import { ConsentsService } from './consents.service';
import { ConsentsController } from './consents.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [ConsentsService],
  controllers: [ConsentsController],
})
export class ConsentsModule {}
