import { IsInt, Max, Min } from 'class-validator';
import { FREEZE_MAX_DAYS_PER_REQUEST } from '../membership.const';

// P2.1: заморозка всегда начинается сегодня и длится целое число дней;
// остаток лимита по типу абонемента проверяет сервис (ему нужен текущий
// frozenDaysUsed из БД).
export class FreezeMembershipDto {
  @IsInt()
  @Min(1)
  @Max(FREEZE_MAX_DAYS_PER_REQUEST)
  days!: number;
}
