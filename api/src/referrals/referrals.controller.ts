import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ReferralsService } from './referrals.service';
import { ApplyReferralDto, UpdateReferralSettingsDto } from './dto/referral.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Реферальная программа (P4.4): клиент работает со своей страницей «приведи
// друга» (me/apply), владелец настраивает проценты и включённость.
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Roles(Role.CLIENT)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.referrals.me(user);
  }

  @Roles(Role.CLIENT)
  @Post('apply')
  apply(@Body() dto: ApplyReferralDto, @CurrentUser() user: JwtPayload) {
    return this.referrals.apply(user, dto);
  }

  @Roles(Role.CEO)
  @Get('settings')
  settings(@CurrentUser() user: JwtPayload) {
    return this.referrals.getSettings(user.gymId);
  }

  @Roles(Role.CEO)
  @Put('settings')
  updateSettings(@Body() dto: UpdateReferralSettingsDto, @CurrentUser() user: JwtPayload) {
    return this.referrals.updateSettings(user, dto);
  }
}
