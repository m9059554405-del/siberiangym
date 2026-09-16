import { randomUUID } from 'node:crypto';
import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateBucketCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Объектное хранилище для фото (P0.5) — вместо data URL прямо в Postgres.
// S3-совместимый клиент: в проде указывает на внешний S3 (Selectel и
// т.п. — целевая конфигурация сервера предполагает отдельное S3-хранилище,
// не MinIO на том же VPS), в локальной разработке — на MinIO из
// docker-compose.yml. Код идентичен в обоих случаях, разница только в
// переменных окружения (S3_ENDPOINT/S3_BUCKET/...).
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    this.bucket = this.config.get<string>('S3_BUCKET') ?? 'siberiangym-media';
    this.configured = !!endpoint;

    if (!this.configured) {
      this.client = null;
      this.publicBaseUrl = '';
      return;
    }

    this.client = new S3Client({
      endpoint,
      region: this.config.get<string>('S3_REGION') ?? 'ru-1',
      forcePathStyle: this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      credentials: {
        accessKeyId: this.config.get<string>('S3_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('S3_SECRET_ACCESS_KEY') ?? '',
      },
    });
    // Домен, по которому объекты реально доступны читателю (браузеру) —
    // не обязательно совпадает с S3_ENDPOINT (там, где провайдер отдаёт
    // публичный CDN-домен отдельно от API-эндпоинта записи).
    this.publicBaseUrl = (this.config.get<string>('S3_PUBLIC_URL') ?? `${endpoint}/${this.bucket}`).replace(/\/$/, '');
  }

  // Не блокирует старт приложения без настроенного S3 (как и EmailService
  // без SMTP) — просто загрузка фото не будет работать, пока не заполнены
  // переменные окружения; остальной сервис при этом не ломается.
  async onModuleInit() {
    if (!this.configured || !this.client) {
      this.logger.warn('S3_ENDPOINT не настроен — загрузка фото работать не будет, пока не заполнены переменные окружения S3_*');
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Бакет "${this.bucket}" создан`);
      } catch (err) {
        // В проде бакет обычно уже создан вручную администратором через
        // консоль провайдера (см. DEPLOY_GUIDE.md) — отсутствие прав на
        // CreateBucket там ожидаемо и не должно ронять старт приложения.
        this.logger.warn(`Не удалось создать/проверить бакет "${this.bucket}" — если он уже существует и настроен вручную, это нормально: ${(err as Error).message}`);
      }
    }
  }

  async uploadPhoto(buffer: Buffer, mimeType: string): Promise<string> {
    if (!this.configured || !this.client) {
      throw new BadRequestException('Загрузка фото недоступна — объектное хранилище не настроено на сервере');
    }
    const ext = ALLOWED_MIME_TYPES[mimeType];
    if (!ext) throw new BadRequestException('Поддерживаются только изображения JPEG, PNG или WebP');

    const key = `photos/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: 'public-read',
      }),
    );
    return `${this.publicBaseUrl}/${key}`;
  }
}
