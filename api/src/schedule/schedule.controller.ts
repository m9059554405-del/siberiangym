import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ScheduleService } from './schedule.service';
import { CreateGroupClassDto } from './dto/create-group-class.dto';
import { CreateGroupClassSeriesDto, UpdateGroupClassSeriesDto } from './dto/create-group-class-series.dto';
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

  // Серии регулярных занятий (P2.12): список с будущими occurrence,
  // создание шаблона с автогенерацией, редактирование (будущие occurrence
  // без записей пересоздаются по новому шаблону), отмена серии
  // (с уведомлением записанных клиентов) и ручная догенерация пропущенных
  // дат в пределах горизонта. Только CEO/STAFF — клиенты видят результат
  // как обычные занятия в GET /group-classes.
  @Roles(Role.CEO, Role.STAFF)
  @Get('group-class-series')
  listSeries(@CurrentUser() user: JwtPayload) {
    return this.schedule.listSeries(user);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post('group-class-series')
  createSeries(@Body() dto: CreateGroupClassSeriesDto, @CurrentUser() user: JwtPayload) {
    return this.schedule.createSeries(user, dto);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Patch('group-class-series/:id')
  updateSeries(@Param('id') id: string, @Body() dto: UpdateGroupClassSeriesDto, @CurrentUser() user: JwtPayload) {
    return this.schedule.updateSeries(user, id, dto);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Delete('group-class-series/:id')
  cancelSeries(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedule.cancelSeries(user, id);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post('group-class-series/:id/regenerate')
  regenerateSeries(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.schedule.regenerateSeries(user, id);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post('group-classes/:id/cancel')
  cancelGroupClassBooking(@Param('id') id: string, @Body('clientId') clientId: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.schedule.cancelGroupClassBooking(user, id, clientId);
  }

  // Лист ожидания (P2.3): встать может сам клиент или персонал за клиента
  // (clientId в теле), выйти — так же; список очереди приходит вместе с
  // GET /group-classes.
  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post('group-classes/:id/waitlist')
  joinWaitlist(@Param('id') id: string, @Body('clientId') clientId: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.schedule.joinWaitlist(user, id, clientId);
  }

  @Roles(Role.CEO, Role.STAFF, Role.CLIENT)
  @Post('group-classes/:id/waitlist/cancel')
  leaveWaitlist(@Param('id') id: string, @Body('clientId') clientId: string | undefined, @CurrentUser() user: JwtPayload) {
    return this.schedule.leaveWaitlist(user, id, clientId);
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
