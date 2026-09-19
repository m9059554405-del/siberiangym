import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCorporateAccountDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;
}

export class UpdateCorporateAccountDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsOptional()
  isActive?: boolean;
}

export class AddCorporateMemberDto {
  @IsString()
  clientId!: string;
}
