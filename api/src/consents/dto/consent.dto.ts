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

// Согласие законного представителя за несовершеннолетнего (P0.6) —
// оформляет CEO/STAFF, не сам клиент.
export class GrantMinorConsentDto {
  @IsString()
  clientId!: string;

  @IsEnum(ConsentType)
  type!: ConsentType;
}
