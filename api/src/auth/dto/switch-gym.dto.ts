import { IsString, MinLength } from 'class-validator';

export class SwitchGymDto {
  @IsString()
  @MinLength(1)
  gymId!: string;
}
