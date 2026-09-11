import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLog: ActivityLogService) {}

  @Roles(Role.CEO)
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.activityLog.findAll(user.gymId);
  }
}
