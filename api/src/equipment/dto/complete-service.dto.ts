import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteServiceDto {
  @IsString()
  @MinLength(2)
  responsibleName!: string;

  @IsOptional()
  @IsDateString()
  serviceDate?: string;
}
