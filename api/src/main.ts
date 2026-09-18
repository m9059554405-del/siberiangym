import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/global-exception.filter';

const logger = new Logger('Bootstrap');

// P3.22: процесс не должен падать «молча». unhandledRejection/uncaughtException
// логируются со стеком до того, как отдать процесс менеджеру (сейчас —
// Docker restart, с P3.18 — PM2): причина падения остаётся в логах.
process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  logger.error(`unhandledRejection: ${err.message}`, err.stack);
});
process.on('uncaughtException', (err) => {
  logger.error(`uncaughtException: ${err.message}`, err.stack);
  // Даём Logger достать сообщение в stdout, затем перезапускаемся —
  // состояние процесса после uncaughtException неопределённое (Node docs).
  setTimeout(() => process.exit(1), 100);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // P3.26: раньше enableCors() без опций = Access-Control-Allow-Origin: *
  // для всего API. Теперь origin ограничен: список из CORS_ORIGINS (через
  // запятую), иначе единственный PUBLIC_APP_URL, иначе (локальная
  // разработка без настроек) — отражение источника запроса. Браузерное
  // приложение ходит через Caddy same-origin и CORS-заголовки ему не
  // нужны — список реально нужен только для внешних/ dev-клиентов.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const publicAppUrl = (process.env.PUBLIC_APP_URL ?? '').replace(/\/$/, '');
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : publicAppUrl ? [publicAppUrl] : true,
    credentials: false,
  });
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(json({ limit: '1mb' }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.setGlobalPrefix('api');
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`SiberianGym API запущен: http://localhost:${port}/api`);
}
bootstrap();
