import { IsArray, IsBoolean, IsEmail, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { EmploymentType } from '@prisma/client';

// P1.4: заведение тренера "в один проход" — карточка + статус занятости +
// точки сети + согласие сотрудника + логин, а не несколько отдельных
// действий CEO/STAFF, как было раньше (create → create-login отдельно).
export class CreateTrainerDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  specialization!: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @IsInt()
  @Min(0)
  personalSessionPrice!: number;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  revenueSharePercent?: number;

  // Точки сети сверх домашней (текущей по токену) — только CEO может
  // назначить сразу при заведении; для STAFF игнорируется на уровне
  // сервиса (доступ у STAFF — только в рамках своей текущей точки).
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  additionalGymIds?: string[];

  // Согласие сотрудника на обработку ПДн (STAFF_PDN) — фиксируется по
  // факту подписанной на месте бумажной формы, не self-service.
  @IsOptional()
  @IsBoolean()
  staffConsentGranted?: boolean;

  // Логин выдаётся сразу, одним действием, если оба поля переданы.
  @IsOptional()
  @IsEmail()
  loginEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  loginPassword?: string;
}
