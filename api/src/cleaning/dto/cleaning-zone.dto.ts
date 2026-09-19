import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateCleaningZoneDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

export class UpdateCleaningZoneDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  position?: number;
}
