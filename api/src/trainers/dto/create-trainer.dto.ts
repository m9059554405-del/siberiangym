import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateTrainerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  specialization!: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @IsInt()
  @Min(0)
  personalSessionPrice!: number;
}
