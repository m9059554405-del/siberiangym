import { ArrayNotEmpty, ArrayUnique, IsArray, IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

// P2.12: шаблон серии еженедельных групповых занятий. Время и дни недели
// фиксированы на серию (переносы отдельных дат — создание обычного занятия
// вручную), генерация occurrence идёт от startDate вперёд на horizonDays.
export class CreateGroupClassSeriesDto {
  @IsString()
  type!: string;

  @IsString()
  trainerId!: string;

  @IsString()
  zone!: string;

  @IsString()
  start!: string; // "HH:MM"

  @IsString()
  end!: string;

  @IsInt()
  @Min(1)
  capacity!: number;

  // 0=Пн ... 6=Вс — та же нумерация, что TrainerWorkHour.day
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays!: number[];

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  // Глубина скользящего горизонта генерации в днях (4 недели по умолчанию —
  // пример из бэклога P2.12; верхняя граница защищает от «года вперёд»).
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  horizonDays?: number;
}

// Каждое поле серии можно менять независимо; незаполненные остаются как были.
export class UpdateGroupClassSeriesDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  trainerId?: string;

  @IsOptional()
  @IsString()
  zone?: string;

  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  weekdays?: number[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  horizonDays?: number;
}
