import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { OrdersModule } from './orders/orders.module';
import { RefundsModule } from './refunds/refunds.module';
import { ConsentsModule } from './consents/consents.module';
import { StorageModule } from './storage/storage.module';
import { GuardiansModule } from './guardians/guardians.module';
import { GymsModule } from './gyms/gyms.module';
import { CheckinsModule } from './checkins/checkins.module';
import { SmsModule } from './sms/sms.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LeadsModule } from './leads/leads.module';
import { AcquiringModule } from './acquiring/acquiring.module';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{
          name: 'default',
          limit: Number(config.get('API_RATE_LIMIT', 120)),
          ttl: Number(config.get('API_RATE_WINDOW_MS', 60_000)),
        }, {
          name: 'login',
          limit: Number(config.get('LOGIN_RATE_LIMIT', 5)),
          ttl: Number(config.get('LOGIN_RATE_WINDOW_MS', 60_000)),
          blockDuration: Number(config.get('LOGIN_BLOCK_DURATION_MS', 300_000)),
          skipIf: (context) => context.getClass().name !== 'AuthController' || context.getHandler().name !== 'login',
        }],
        errorMessage: 'Слишком много запросов. Повторите попытку позже.',
      }),
    }),
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
    OrdersModule,
    RefundsModule,
    ConsentsModule,
    StorageModule,
    GuardiansModule,
    GymsModule,
    CheckinsModule,
    SmsModule,
    NotificationsModule,
    LeadsModule,
    AcquiringModule,
    PaymentsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
