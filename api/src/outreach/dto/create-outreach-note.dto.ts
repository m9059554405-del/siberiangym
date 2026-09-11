import { IsBoolean, IsString } from 'class-validator';

export class CreateOutreachNoteDto {
  @IsString()
  clientId!: string;

  @IsBoolean()
  called!: boolean;

  @IsString()
  reason!: string;
}
