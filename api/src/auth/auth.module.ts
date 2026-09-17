import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GymsModule } from '../gyms/gyms.module';

@Module({
  imports: [
    PassportModule,
    GymsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        // expiresIn в секундах (число) — избегаем строкового типа '7d',
        // у @nestjs/jwt он завязан на литеральный тип из пакета ms.
        signOptions: { expiresIn: Number(config.get<string>('JWT_EXPIRES_IN_SECONDS') ?? 604800) },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
