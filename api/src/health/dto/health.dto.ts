import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ProgressPhotoKind, MealType } from '@prisma/client';

export class AddProgressPhotoDto {
  @IsEnum(ProgressPhotoKind)
  kind!: ProgressPhotoKind;

  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;

  @IsString()
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
