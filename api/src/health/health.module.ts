import { Module } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthController, PublicHealthController } from './health.controller';

@Module({
  providers: [HealthService],
  controllers: [PublicHealthController, HealthController],
})
export class HealthModule {}
