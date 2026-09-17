import { IsInt, IsOptional, Min } from 'class-validator';

// Все поля необязательны — PATCH обновляет только переданные, остальные
// остаются как есть (используется и для разовой правки одной цены, не
// требует присылать весь прайс-лист целиком).
export class UpdatePricingDto {
  @IsOptional() @IsInt() @Min(0) single?: number;
  @IsOptional() @IsInt() @Min(0) monthly?: number;
  @IsOptional() @IsInt() @Min(0) pack10?: number;
  @IsOptional() @IsInt() @Min(0) pack20?: number;

  // Сетевые варианты (P1.2) — null явно очищает цену (точка перестаёт
  // продавать сетевой вариант этого типа), undefined — не менять.
  @IsOptional() @IsInt() @Min(0) singleNetwork?: number | null;
  @IsOptional() @IsInt() @Min(0) monthlyNetwork?: number | null;
  @IsOptional() @IsInt() @Min(0) pack10Network?: number | null;
  @IsOptional() @IsInt() @Min(0) pack20Network?: number | null;

  @IsOptional() @IsInt() @Min(0) personalSingle?: number;
  @IsOptional() @IsInt() @Min(0) personalPack5?: number;
  @IsOptional() @IsInt() @Min(0) groupSingle?: number;
  @IsOptional() @IsInt() @Min(0) groupMonthly?: number;
}
