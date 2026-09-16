import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ProgressPhotoKind, MealType } from '@prisma/client';

export class AddProgressPhotoDto {
  @IsEnum(ProgressPhotoKind)
  kind!: ProgressPhotoKind;

  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;

  // С P0.5 это ссылка на объектное хранилище (S3), полученная от
  // POST /uploads/photo — не data URL. IsUrl + MaxLength вместе не дают
  // обойти /uploads/photo прямой передачей сырых данных в этом поле.
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

export class AddMeasurementDto {
  @IsOptional()
  @IsNumber()
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  bodyFatPercent?: number;

  @IsOptional()
  @IsNumber()
  muscleMassKg?: number;

  @IsOptional()
  @IsNumber()
  waterPercent?: number;

  @IsOptional()
  @IsNumber()
  visceralFat?: number;

  @IsOptional()
  @IsNumber()
  chestCm?: number;

  @IsOptional()
  @IsNumber()
  waistCm?: number;

  @IsOptional()
  @IsNumber()
  hipsCm?: number;
}

export class AddCycleLogDto {
  @IsOptional()
  @IsDateString()
  date?: string;
}
