import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CleaningArea, Role } from '@prisma/client';
import { CleaningService } from './cleaning.service';
import { CreateChecklistDto } from './dto/create-checklist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller('cleaning-checklists')
export class CleaningController {
  constructor(private readonly cleaning: CleaningService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.cleaning.findAll(user.gymId);
  }

  @Post()
  create(@Body() dto: CreateChecklistDto, @CurrentUser() user: JwtPayload) {
    return this.cleaning.create(user, dto);
  }

  @Post(':id/toggle/:area')
  toggleItem(@Param('id') id: string, @Param('area') area: CleaningArea, @CurrentUser() user: JwtPayload) {
    return this.cleaning.toggleItem(user, id, area);
  }
}
