import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { MuscleGroup } from '@prisma/client';

export class CreateExerciseDto {
  @IsString()
  name!: string;

  @IsEnum(MuscleGroup)
  muscleGroup!: MuscleGroup;

  @IsInt()
  @Min(1)
  defaultSets!: number;

  @IsString()
  defaultReps!: string;

  @IsString()
  defaultLoad!: string;

  @IsOptional()
  @IsString()
  technique?: string;

  @IsOptional()
  @IsString()
  equipment?: string;
}
