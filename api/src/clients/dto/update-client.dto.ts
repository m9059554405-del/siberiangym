import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { Gender } from '@prisma/client';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  birthday?: string;

  // С P0.5 это ссылка на объектное хранилище (S3), полученная от
  // POST /uploads/photo — не data URL.
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  profilePhotoUrl?: string;
}
