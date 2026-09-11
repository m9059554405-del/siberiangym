import { Module } from '@nestjs/common';
import { TrainersService } from './trainers.service';
import { TrainersController } from './trainers.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ActivityLogModule, AuthModule],
  providers: [TrainersService],
  controllers: [TrainersController],
})
export class TrainersModule {}
