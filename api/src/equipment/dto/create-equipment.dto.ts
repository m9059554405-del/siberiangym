import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EquipmentCategory } from '@prisma/client';

export class CreateEquipmentDto {
  @IsString()
  name!: string;

  @IsEnum(EquipmentCategory)
  category!: EquipmentCategory;

  @IsString()
  zone!: string;

  @IsString()
  responsibleName!: string;

  @IsDateString()
  lastServiceDate!: string;

  @IsInt()
  @Min(1)
  intervalDays!: number;

  @IsOptional()
  @IsDateString()
  warrantyUntil?: string;
}
