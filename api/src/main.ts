import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  // Фото теперь идут через multipart (POST /uploads/photo, см. P0.5), а не
  // как data URL в JSON-теле — дефолт body-parser (100kb) здесь больше не
  // проблема сам по себе, но явный лимит стоит задать в любом случае, а не
  // полагаться на неявный дефолт библиотеки. 1mb с запасом покрывает любые
  // обычные JSON-запросы приложения (ни один из них не содержит файлов).
  app.use(json({ limit: '1mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`SiberianGym API запущен: http://localhost:${port}/api`);
}
bootstrap();
