import { IsString, MinLength } from 'class-validator';

export class CreateDirectorMessageDto {
  @IsString()
  @MinLength(1)
  text!: string;
}

export class ReplyDirectorMessageDto {
  @IsString()
  @MinLength(1)
  reply!: string;
}
