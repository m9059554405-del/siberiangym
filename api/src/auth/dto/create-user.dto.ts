import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

// Создание учётной записи (логина) сотрудником с правами CEO/STAFF.
// Для клиента отдельно есть флоу регистрации карточки без логина —
// см. модуль clients.
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsEnum(Role)
  role!: Role;
}
