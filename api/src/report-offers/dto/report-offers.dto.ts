import { IsEnum, IsString, MinLength } from 'class-validator';
import { OfferAudience } from '@prisma/client';

export class CreateReportOfferDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsEnum(OfferAudience)
  audience!: OfferAudience;
}
