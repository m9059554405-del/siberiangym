import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum BulkClientsAction {
  REASSIGN = 'REASSIGN',
  SELF = 'SELF',
}

export class BulkClientsDto {
  @IsEnum(BulkClientsAction)
  action!: BulkClientsAction;

  @IsOptional()
  @IsString()
  targetTrainerId?: string;
}
