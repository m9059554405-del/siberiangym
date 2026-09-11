import { IsDateString, IsString } from 'class-validator';

export class CreatePersonalSlotDto {
  @IsString()
  trainerId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  start!: string;

  @IsString()
  end!: string;
}
