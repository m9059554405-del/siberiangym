import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ApplyReferralDto {
  @IsString()
  code!: string;
}

// Частичное обновление: незаполненные поля остаются прежними.
export class UpdateReferralSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  referrerPercent?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  referredPercent?: number;
}
