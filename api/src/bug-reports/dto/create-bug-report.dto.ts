import { Transform } from 'class-transformer';
import { IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBugReportDto {
  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  problem!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(4000)
  expected!: string;

  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  })
  @IsObject()
  telemetry!: Record<string, unknown>;
}
