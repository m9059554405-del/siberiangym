import { Module } from '@nestjs/common';
import { DirectorMessagesService } from './director-messages.service';
import { DirectorMessagesController } from './director-messages.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [DirectorMessagesService],
  controllers: [DirectorMessagesController],
})
export class DirectorMessagesModule {}
