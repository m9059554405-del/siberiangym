import { BugReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBugReportDto {
  @IsEnum(BugReportStatus)
  status!: BugReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  resolutionNote?: string;
}
