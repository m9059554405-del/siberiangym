import { Module } from '@nestjs/common';
import { ClubPostsService } from './club-posts.service';
import { ClubPostsController } from './club-posts.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [ActivityLogModule],
  providers: [ClubPostsService],
  controllers: [ClubPostsController],
})
export class ClubPostsModule {}
