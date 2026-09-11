import { Module } from '@nestjs/common';
import { LockersService } from './lockers.service';
import { LockersController } from './lockers.controller';

@Module({
  providers: [LockersService],
  controllers: [LockersController],
})
export class LockersModule {}
