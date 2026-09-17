import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { CheckinSource } from '@prisma/client';

// P2.2: код прохода — строка из QR клиента («Мой QR», формат
// sgym-checkin:<clientId>) либо та же строка, введённая вручную.
// Способ фиксируется отдельно: ручной ввод — не то же самое, что скан,
// и по журналу проходов видно, работал ли сканер.
export class ScanCheckinDto {
  @IsString()
  @MinLength(8)
  code!: string;

  @IsOptional()
  @IsEnum(CheckinSource)
  source?: CheckinSource;
}
