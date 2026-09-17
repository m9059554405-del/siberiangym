import { IsString, MinLength } from 'class-validator';

// P2.4: браузер отдаёт PushSubscription после subscribe(vapid) — сохраняем
// её «сырые» поля, не таща наверх вложенный объект keys.
export class SubscribePushDto {
  @IsString()
  @MinLength(16)
  endpoint!: string;

  @IsString()
  @MinLength(16)
  p256dh!: string;

  @IsString()
  @MinLength(8)
  auth!: string;
}
