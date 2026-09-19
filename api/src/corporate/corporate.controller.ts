import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CorporateService } from './corporate.service';
import { AddCorporateMemberDto, CreateCorporateAccountDto, UpdateCorporateAccountDto } from './dto/corporate.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Корпоративные договоры (P4.4): операционная работа с ними — на ресепшене
// (STAFF) и у владельца (CEO); удаление — только CEO и только без заказов.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.STAFF, Role.CEO)
@Controller('corporate')
export class CorporateController {
  constructor(private readonly corporate: CorporateService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.corporate.list(user.gymId);
  }

  @Post()
  create(@Body() dto: CreateCorporateAccountDto, @CurrentUser() user: JwtPayload) {
    return this.corporate.create(user, dto);
  }

  @Get(':id')
  detail(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.corporate.detail(user, id);
  }

  @Get(':id/statement')
  statement(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.corporate.statement(user, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCorporateAccountDto, @CurrentUser() user: JwtPayload) {
    return this.corporate.update(user, id, dto);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() dto: AddCorporateMemberDto, @CurrentUser() user: JwtPayload) {
    return this.corporate.addMember(user, id, dto);
  }

  @Delete(':id/members/:clientId')
  removeMember(@Param('id') id: string, @Param('clientId') clientId: string, @CurrentUser() user: JwtPayload) {
    return this.corporate.removeMember(user, id, clientId);
  }

  @Roles(Role.CEO)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.corporate.remove(user, id);
  }
}
