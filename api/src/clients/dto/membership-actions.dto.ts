import { IsEnum, IsString } from 'class-validator';
import { MembershipType, Tariff } from '@prisma/client';

export class ChooseTrainerDto {
  @IsString()
  trainerId!: string;

  @IsEnum(Tariff)
  tariff!: Tariff;
}

export class ChangeTariffDto {
  @IsEnum(Tariff)
  tariff!: Tariff;
}

export class PurchaseMembershipDto {
  @IsEnum(MembershipType)
  type!: MembershipType;
}
