import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';

// Лимит на самом эндпоинте — страховка уже ПОСЛЕ клиентского сжатия
// (ProgressPage.tsx ужимает фото до ~300–500 КБ перед отправкой), а не
// вместо него: прямой вызов API в обход интерфейса не должен пройти с
// сырым файлом с камеры в несколько мегабайт. Согласовано с
// client_max_body_size в web/nginx.conf — оба меняются одним изменением.
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

// Общий эндпоинт загрузки фото (P0.5) — переиспользуется для фото
// прогресса, фото еды и фото профиля: клиент сначала загружает файл сюда
// (multipart, не JSON) и получает URL, затем передаёт этот URL в обычные
// JSON-запросы (POST /progress-photos, PATCH /clients/:id) — их DTO не
// меняются, просто теперь принимают S3-URL вместо data URL.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PHOTO_SIZE_BYTES } }))
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Фото не передано');
    const url = await this.storage.uploadPhoto(file.buffer, file.mimetype);
    return { url };
  }
}
