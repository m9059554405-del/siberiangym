import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsDateString()
  @IsOptional()
  visitDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
