import { IsArray, IsInt, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ProgramExerciseEntryDto {
  @IsString()
  exerciseId!: string;

  @IsInt()
  @Min(1)
  sets!: number;

  @IsString()
  reps!: string;

  @IsString()
  load!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

class ProgramDayDto {
  @IsString()
  label!: string;

  @IsInt()
  @Min(0)
  order!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramExerciseEntryDto)
  entries!: ProgramExerciseEntryDto[];
}

export class SetProgramDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProgramDayDto)
  days!: ProgramDayDto[];
}
