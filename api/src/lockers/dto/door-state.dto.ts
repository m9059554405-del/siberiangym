import { IsIn, IsInt, IsString, Min } from 'class-validator';

// Колбэк состояния дверцы от контроллера (P2.8): terminal/контроллер
// сообщает, что замок физически открылся/закрылся.
export class DoorStateDto {
  @IsString()
  controllerId!: string;

  @IsInt()
  @Min(1)
  channel!: number;

  @IsIn(['OPEN', 'CLOSED'])
  state!: 'OPEN' | 'CLOSED';
}
