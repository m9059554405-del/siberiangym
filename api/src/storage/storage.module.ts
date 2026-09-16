import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

@Module({
  providers: [StorageService],
  controllers: [UploadsController],
  exports: [StorageService],
})
export class StorageModule {}
