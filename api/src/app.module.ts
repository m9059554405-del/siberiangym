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
import { ExercisesModule } from './exercises/exercises.module';
import { ProgramsModule } from './programs/programs.module';
import { WorkoutLogsModule } from './workout-logs/workout-logs.module';
import { LockersModule } from './lockers/lockers.module';
import { ClubPostsModule } from './club-posts/club-posts.module';
import { FeedbackModule } from './feedback/feedback.module';
import { HealthModule } from './health/health.module';
import { PricingModule } from './pricing/pricing.module';
import { TransactionsModule } from './transactions/transactions.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EmailModule,
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
    ExercisesModule,
    ProgramsModule,
    WorkoutLogsModule,
    LockersModule,
    ClubPostsModule,
    FeedbackModule,
    HealthModule,
    PricingModule,
    TransactionsModule,
  ],
})
export class AppModule {}
