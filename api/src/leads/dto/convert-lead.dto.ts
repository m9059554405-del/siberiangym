import { IsString } from 'class-validator';

export class ConvertLeadDto {
  // Клиент, который вырос из этого лида: персонал регистрирует его
  // обычным путём (с абонементом и чеком), конвертация только фиксирует
  // связь для истории воронки.
  @IsString()
  clientId!: string;
}
