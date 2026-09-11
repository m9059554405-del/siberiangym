import { IsDateString, IsString } from 'class-validator';

export class CreateChecklistDto {
  @IsDateString()
  date!: string;

  @IsString()
  responsibleName!: string;
}
