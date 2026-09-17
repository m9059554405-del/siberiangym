import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { WorkoutLogsService } from './workout-logs.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class WorkoutLogsController {
  constructor(private readonly workoutLogs: WorkoutLogsService) {}

  @Roles(Role.CEO, Role.STAFF)
  @Get('workout-logs')
  listAll(@CurrentUser() user: JwtPayload) {
    return this.workoutLogs.listAll(user.gymId);
  }

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Get('clients/:clientId/workout-logs')
  listForClient(@Param('clientId') clientId: string, @CurrentUser() user: JwtPayload) {
    return this.workoutLogs.listForClient(user, clientId);
  }

  @Roles(Role.CLIENT)
  @Get('workout-logs/mine')
  listOwn(@CurrentUser() user: JwtPayload) {
    return this.workoutLogs.listOwn(user);
  }

  @Get('workout-logs/leaderboard')
  leaderboard(@Query('period') period: 'day' | 'week' | 'month' = 'week', @CurrentUser() user: JwtPayload) {
    return this.workoutLogs.leaderboard(user.gymId, period);
  }

  @Roles(Role.CLIENT)
  @Post('workout-logs')
  log(@Body() dto: LogWorkoutDto, @CurrentUser() user: JwtPayload) {
    return this.workoutLogs.log(user, dto);
  }
}
