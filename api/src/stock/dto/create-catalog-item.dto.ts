import { IsEnum, IsInt, IsString, Min, MinLength } from 'class-validator';
import { CatalogCategory } from '@prisma/client';

export class CreateCatalogItemDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(CatalogCategory)
  category!: CatalogCategory;

  @IsInt()
  @Min(0)
  price!: number;

  @IsString()
  emoji!: string;
}
