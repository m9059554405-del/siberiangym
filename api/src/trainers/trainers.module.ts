import { Module } from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { TrainersController } from './trainers.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AuthModule } from '../auth/auth.module';
import { GymsModule } from '../gyms/gyms.module';
import { ConsentsModule } from '../consents/consents.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ActivityLogModule, AuthModule, GymsModule, ConsentsModule, NotificationsModule],
  providers: [TrainersService],
  controllers: [TrainersController],
  exports: [TrainersService],
})
export class TrainersModule {}
