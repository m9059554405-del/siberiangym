import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateGuardianDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  @MinLength(5)
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Кем приходится ребёнку — справочник на уровне приложения, не enum
  // (по тому же принципу, что GroupClass.type): "родитель", "опекун" и т.п.
  @IsString()
  relation!: string;

  // Если сам представитель тоже тренируется в клубе — привязка к уже
  // существующей карточке Client вместо дублирования контактов.
  @IsOptional()
  @IsString()
  linkedClientId?: string;
}

export class LinkChildDto {
  @IsString()
  clientId!: string;
}
