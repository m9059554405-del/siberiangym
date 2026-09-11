import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { StockService } from './stock.service';
import { CreateCatalogItemDto } from './dto/create-catalog-item.dto';
import { ReceiveStockDto, WriteOffStockDto, FinalizeInventoryDto } from './dto/stock-operations.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Склад доступен и CEO, и STAFF (Администратор) с одинаковыми правами —
// так же, как в демо-версии.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller('stock')
export class StockController {
  constructor(private readonly stock: StockService) {}

  @Get('catalog')
  listCatalog(@CurrentUser() user: JwtPayload) {
    return this.stock.listCatalog(user.gymId);
  }

  @Post('catalog')
  createCatalogItem(@Body() dto: CreateCatalogItemDto, @CurrentUser() user: JwtPayload) {
    return this.stock.createCatalogItem(user, dto);
  }

  @Get('summary')
  summary(@CurrentUser() user: JwtPayload) {
    return this.stock.summary(user.gymId);
  }

  @Post('receive')
  receive(@Body() dto: ReceiveStockDto, @CurrentUser() user: JwtPayload) {
    return this.stock.receive(user, dto);
  }

  @Post('write-off')
  writeOff(@Body() dto: WriteOffStockDto, @CurrentUser() user: JwtPayload) {
    return this.stock.writeOff(user, dto);
  }

  @Post('inventory')
  finalizeInventory(@Body() dto: FinalizeInventoryDto, @CurrentUser() user: JwtPayload) {
    return this.stock.finalizeInventory(user, dto);
  }

  @Get('history')
  history(@CurrentUser() user: JwtPayload) {
    return this.stock.history(user.gymId);
  }
}
