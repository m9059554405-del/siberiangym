import { IsEnum, IsString, MinLength } from 'class-validator';
import { ClubPostType } from '@prisma/client';

export class CreateClubPostDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  text!: string;

  @IsEnum(ClubPostType)
  type!: ClubPostType;
}
