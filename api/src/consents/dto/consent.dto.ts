import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ConsentType } from '@prisma/client';

export class GrantConsentDto {
  @IsEnum(ConsentType)
  type!: ConsentType;
}

export class DeletionRequestDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
