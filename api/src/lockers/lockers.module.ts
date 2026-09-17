import { Module } from '@nestjs/common';
import { LockersService } from './lockers.service';
import { LockersController } from './lockers.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { GymsModule } from '../gyms/gyms.module';
import { LockerControllerDriver, LoggingLockerControllerDriver } from './locker-controller.driver';

@Module({
  imports: [ActivityLogModule, GymsModule],
  providers: [
    // Драйвер контроллера замков (P2.8): здесь подменяется реальный
    // (Kerong или другой) — вся логика киоска выше уровня драйвера.
    { provide: LockerControllerDriver, useClass: LoggingLockerControllerDriver },
    LockersService,
  ],
  controllers: [LockersController],
})
export class LockersModule {}
