import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  // Точка сети, к которой прикрепляется администратор (по заявке клуба —
  // управление точками). Не задана — текущая точка токена CEO (как раньше).
  @IsOptional()
  @IsString()
  gymId?: string;
}
