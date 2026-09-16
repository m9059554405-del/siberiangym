import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { LockersService } from './lockers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('lockers')
export class LockersController {
  constructor(private readonly lockers: LockersService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.lockers.findAll(user.gymId);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post(':id/release')
  release(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.lockers.release(user, id);
  }
}
