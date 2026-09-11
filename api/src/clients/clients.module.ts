import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ActivityLogModule, AuthModule],
  providers: [ClientsService],
  controllers: [ClientsController],
})
export class ClientsModule {}
