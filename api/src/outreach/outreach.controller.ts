import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { OutreachService } from './outreach.service';
import { CreateOutreachNoteDto } from './dto/create-outreach-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO, Role.STAFF)
@Controller('outreach')
export class OutreachController {
  constructor(private readonly outreach: OutreachService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.outreach.listWithNotes(user.gymId);
  }

  // Записывать результат звонка может только Администратор — CEO видит
  // список и заметки в режиме просмотра (как в демо-версии).
  @Roles(Role.STAFF)
  @Post()
  create(@Body() dto: CreateOutreachNoteDto, @CurrentUser() user: JwtPayload) {
    return this.outreach.create(user, dto.clientId, dto.called, dto.reason);
  }
}
