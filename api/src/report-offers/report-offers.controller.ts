import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReportOffersService } from './report-offers.service';
import { CreateReportOfferDto } from './dto/report-offers.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO)
@Controller('report-offers')
export class ReportOffersController {
  constructor(private readonly offers: ReportOffersService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.offers.findAll(user.gymId);
  }

  @Post()
  create(@Body() dto: CreateReportOfferDto, @CurrentUser() user: JwtPayload) {
    return this.offers.create(user, dto);
  }

  @Post(':id/toggle')
  toggle(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.offers.toggleActive(user, id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.offers.remove(user, id);
  }
}
