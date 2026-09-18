import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum BulkSlotsAction {
  CANCEL = 'CANCEL',
  REASSIGN = 'REASSIGN',
}

export class BulkSlotsDto {
  @IsEnum(BulkSlotsAction)
  action!: BulkSlotsAction;

  @IsOptional()
  @IsString()
  targetTrainerId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;
}
