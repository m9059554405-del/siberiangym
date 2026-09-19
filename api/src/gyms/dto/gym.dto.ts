import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGymDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  selfTrainingMinAge?: number;
}

export class UpdateGymDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  selfTrainingMinAge?: number;
}

export class MoveStaffDto {
  @IsString()
  gymId!: string;
}

// Часы работы точки (P4.2) — PUT заменяет весь набор одним списком:
// дни не в списке считаются «без ограничений», пустой список снимает
// ограничения целиком.
export class WorkingHoursItemDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Время должно быть в формате HH:MM' })
  open!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Время должно быть в формате HH:MM' })
  close!: string;
}

export class ReplaceWorkingHoursDto {
  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursItemDto)
  items!: WorkingHoursItemDto[];
}
