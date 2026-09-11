import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ProgramsService } from './programs.service';
import { SetProgramDto } from './dto/set-program.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF, Role.TRAINER, Role.CLIENT)
@Controller('clients/:clientId/program')
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get()
  get(@Param('clientId') clientId: string, @CurrentUser() user: JwtPayload) {
    return this.programs.getForClient(user.gymId, clientId);
  }

  @Put()
  set(@Param('clientId') clientId: string, @Body() dto: SetProgramDto, @CurrentUser() user: JwtPayload) {
    return this.programs.set(user, clientId, dto);
  }
}
