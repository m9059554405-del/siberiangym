import { Module } from '@nestjs/common';
import { CheckinsService } from './checkins.service';
import { CheckinsController } from './checkins.controller';
import { GymsModule } from '../gyms/gyms.module';

@Module({
  imports: [GymsModule],
  providers: [CheckinsService],
  controllers: [CheckinsController],
})
export class CheckinsModule {}
