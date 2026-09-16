import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { GuardiansService } from './guardians.service';
import { CreateGuardianDto, LinkChildDto } from './dto/guardian.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Заведение законного представителя и привязка к нему детей — операция
// администрации клуба (P0.6), не self-service клиента.
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller('guardians')
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  @Get('search')
  search(@Query('phone') phone: string, @CurrentUser() user: JwtPayload) {
    return this.guardians.search(user.gymId, phone ?? '');
  }

  // До ':id' — иначе роутер примет "for-client" за значение :id.
  @Get('for-client/:clientId')
  listForClient(@Param('clientId') clientId: string, @CurrentUser() user: JwtPayload) {
    return this.guardians.listForClient(user, clientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.guardians.findOne(user, id);
  }

  @Post()
  create(@Body() dto: CreateGuardianDto, @CurrentUser() user: JwtPayload) {
    return this.guardians.create(user, dto);
  }

  @Post(':id/children')
  linkChild(@Param('id') id: string, @Body() dto: LinkChildDto, @CurrentUser() user: JwtPayload) {
    return this.guardians.linkChild(user, id, dto.clientId);
  }

  @Post(':id/children/:clientId/unlink')
  unlinkChild(@Param('id') id: string, @Param('clientId') clientId: string, @CurrentUser() user: JwtPayload) {
    return this.guardians.unlinkChild(user, id, clientId);
  }
}
