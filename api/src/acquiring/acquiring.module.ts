import { Module } from '@nestjs/common';
import { AcquiringService } from './acquiring.service';

@Module({
  providers: [AcquiringService],
  exports: [AcquiringService],
})
export class AcquiringModule {}
