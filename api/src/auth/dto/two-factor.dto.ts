import { IsString, Length, MinLength } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  @MinLength(32)
  challengeToken!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}

export class ConfirmTwoFactorDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
