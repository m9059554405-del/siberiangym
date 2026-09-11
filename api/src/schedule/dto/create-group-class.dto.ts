import { IsDateString, IsInt, IsString, Min } from 'class-validator';

export class CreateGroupClassDto {
  @IsString()
  type!: string;

  @IsString()
  trainerId!: string;

  @IsString()
  zone!: string;

  @IsDateString()
  date!: string;

  @IsString()
  start!: string;

  @IsString()
  end!: string;

  @IsInt()
  @Min(1)
  capacity!: number;
}
