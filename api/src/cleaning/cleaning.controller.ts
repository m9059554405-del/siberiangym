import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CleaningService } from './cleaning.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { CreateCleaningZoneDto, UpdateCleaningZoneDto } from './dto/cleaning-zone.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Чек-листы заполняют CEO и STAFF; набор зон точки (P4.2) настраивает
// только владелец, а читает любая авторизованная роль своей точки
// (страницам клининга нужно показать актуальные названия).
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cleaning-checklists')
export class CleaningController {
  constructor(private readonly cleaning: CleaningService) {}

  @Roles(Role.CEO, Role.STAFF)
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.cleaning.findAll(user.gymId);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post()
  create(@Body() dto: CreateChecklistDto, @CurrentUser() user: JwtPayload) {
    return this.cleaning.create(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post(':id/toggle/:zoneId')
  toggleItem(@Param('id') id: string, @Param('zoneId') zoneId: string, @CurrentUser() user: JwtPayload) {
    return this.cleaning.toggleItem(user, id, zoneId);
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cleaning-zones')
export class CleaningZonesController {
  constructor(private readonly cleaning: CleaningService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.cleaning.listZones(user.gymId);
  }

  @Roles(Role.CEO)
  @Post()
  create(@Body() dto: CreateCleaningZoneDto, @CurrentUser() user: JwtPayload) {
    return this.cleaning.createZone(user, dto);
  }

  @Roles(Role.CEO)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCleaningZoneDto, @CurrentUser() user: JwtPayload) {
    return this.cleaning.updateZone(user, id, dto);
  }

  @Roles(Role.CEO)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.cleaning.removeZone(user, id);
  }
}
