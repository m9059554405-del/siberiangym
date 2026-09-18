import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum TrainerAvailabilityMode {
  ACTIVE = 'ACTIVE',
  UNAVAILABLE = 'UNAVAILABLE',
  DEPARTED = 'DEPARTED',
}

export class SetAvailabilityDto {
  @IsEnum(TrainerAvailabilityMode)
  mode!: TrainerAvailabilityMode;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  until?: string;
}
