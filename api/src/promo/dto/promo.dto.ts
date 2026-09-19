import { IsISO8601, IsInt, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

// Процент ИЛИ фиксированная сумма — ровно одно из двух: если указаны оба
// (или ни одного), ValidateIf пропускает одно поле, но финальную проверку
// «XOR» сервис делает сам с понятным русским сообщением.
export class CreatePromoCodeDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @ValidateIf((o: CreatePromoCodeDto) => !o.amountOff)
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @ValidateIf((o: CreatePromoCodeDto) => !o.percentOff)
  @IsInt()
  @Min(1)
  amountOff?: number;

  @IsOptional()
  @IsISO8601()
  validFrom?: string;

  @IsOptional()
  @IsISO8601()
  validUntil?: string;

  // 0 = без ограничения числа применений
  @IsOptional()
  @IsInt()
  @Min(0)
  maxUses?: number;
}
