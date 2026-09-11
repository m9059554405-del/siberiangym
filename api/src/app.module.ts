import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ActivityLogModule } from './activity-log/activity-log.module';
import { ClientsModule } from './clients/clients.module';
import { TrainersModule } from './trainers/trainers.module';
import { ScheduleModule } from './schedule/schedule.module';
import { StockModule } from './stock/stock.module';
import { EquipmentModule } from './equipment/equipment.module';
import { CleaningModule } from './cleaning/cleaning.module';
import { DirectorMessagesModule } from './director-messages/director-messages.module';
import { ReportOffersModule } from './report-offers/report-offers.module';
import { OutreachModule } from './outreach/outreach.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ActivityLogModule,
    ClientsModule,
    TrainersModule,
    ScheduleModule,
    StockModule,
    EquipmentModule,
    CleaningModule,
    DirectorMessagesModule,
    ReportOffersModule,
    OutreachModule,
  ],
})
export class AppModule {}
