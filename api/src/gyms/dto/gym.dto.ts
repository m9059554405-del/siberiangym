import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

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
