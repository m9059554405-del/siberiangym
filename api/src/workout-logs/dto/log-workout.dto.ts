import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EffortLevel } from '@prisma/client';

class SetLogDto {
  @IsString()
  reps!: string;

  @IsString()
  load!: string;

  @IsBoolean()
  completed!: boolean;

  @IsOptional()
  @IsEnum(EffortLevel)
  effort?: EffortLevel;

  @IsOptional()
  @IsInt()
  restSeconds?: number;
}

class ExerciseLogDto {
  @IsString()
  exerciseId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SetLogDto)
  sets!: SetLogDto[];
}

export class LogWorkoutDto {
  @IsString()
  dayLabel!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExerciseLogDto)
  exercises!: ExerciseLogDto[];
}
