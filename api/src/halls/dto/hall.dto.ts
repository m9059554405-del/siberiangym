import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from 'class-validator';

export class HallPriceItemDto {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsInt()
  @Min(0)
  @Max(100_000_000)
  amount!: number;
}

export class CreateHallDto {
  @IsString()
  gymId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(2)
  kind!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  trainerIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HallPriceItemDto)
  prices?: HallPriceItemDto[];
}

export class UpdateHallDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  kind?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  trainerIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => HallPriceItemDto)
  prices?: HallPriceItemDto[];
}
