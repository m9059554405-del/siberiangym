import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Gender, MembershipType, Tariff } from '@prisma/client';

export class CreateClientDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(Gender)
  gender!: Gender;

  @IsDateString()
  birthday!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  trainerId?: string;

  @IsOptional()
  @IsEnum(Tariff)
  tariff?: Tariff;

  @IsEnum(MembershipType)
  membershipType!: MembershipType;
}
