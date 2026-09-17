import { IsDateString, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

// Статус CONVERTED намеренно не входит в список: он ставится только
// осмысленным действием конвертации (POST /leads/:id/convert с привязкой
// клиента), а не правкой карточки.
export class UpdateLeadDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsDateString()
  @IsOptional()
  visitDate?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsIn(['NEW', 'VISITED', 'LOST'])
  @IsOptional()
  status?: 'NEW' | 'VISITED' | 'LOST';
}
