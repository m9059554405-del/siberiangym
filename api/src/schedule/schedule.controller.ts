import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ScheduleService } from './schedule.service';
import { CreateGroupClassDto } from './dto/create-group-class.dto';
import { CreatePersonalSlotDto } from './dto/create-personal-slot.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ScheduleController {
  constructor(private readonly schedule: ScheduleService) {}

  @Get('group-classes')
  listGroupClasses(@CurrentUser() user: JwtPayload) {
    return this.schedule.listGroupClasses(user);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post('group-classes')
  createGroupClass(@Body() dto: CreateGroupClassDto, @CurrentUser() user: JwtPayload) {
    return this.schedule.createGroupClass(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post('group-classes/:id/cancel')
  cancelGroupClassBooking(@Param('id') id: string, @Body('clientId') clientId: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.schedule.cancelGroupClassBooking(user, id, clientId);
  }

  @Get('personal-slots')
  listPersonalSlots(@CurrentUser() user: JwtPayload) {
    return this.schedule.listPersonalSlots(user);
  }

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Post('personal-slots')
  createPersonalSlot(@Body() dto: CreatePersonalSlotDto, @CurrentUser() user: JwtPayload) {
    return this.schedule.createPersonalSlot(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post('personal-slots/:id/cancel')
  cancelPersonalSlot(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedule.cancelPersonalSlot(user, id);
  }

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Post('personal-slots/:id/complete')
  completeSlot(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedule.markSlotAttendance(user, id, 'PAST_COMPLETED');
  }

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Post('personal-slots/:id/miss')
  missSlot(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedule.markSlotAttendance(user, id, 'PAST_MISSED');
  }
}
