import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StockLocation, WriteoffReason } from '@prisma/client';

export class ReceiveStockDto {
  @IsString()
  catalogItemId!: string;

  @IsEnum(StockLocation)
  location!: StockLocation;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsDateString()
  expiresAt!: string;
}

export class WriteOffStockDto {
  @IsString()
  catalogItemId!: string;

  @IsEnum(StockLocation)
  location!: StockLocation;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsEnum(WriteoffReason)
  reason!: WriteoffReason;

  @IsOptional()
  @IsString()
  comment?: string;
}

export class InventoryEntryDto {
  @IsString()
  catalogItemId!: string;

  @IsEnum(StockLocation)
  location!: StockLocation;

  @IsInt()
  @Min(0)
  countedQty!: number;
}

export class FinalizeInventoryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryEntryDto)
  entries!: InventoryEntryDto[];
}
