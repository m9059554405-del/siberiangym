import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DirectorMessagesService } from './director-messages.service';
import { CreateDirectorMessageDto, ReplyDirectorMessageDto } from './dto/director-messages.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('director-messages')
export class DirectorMessagesController {
  constructor(private readonly messages: DirectorMessagesService) {}

  @Roles(Role.CEO)
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.messages.findAll(user.gymId);
  }

  @Roles(Role.CLIENT)
  @Get('mine')
  findOwn(@CurrentUser() user: JwtPayload) {
    return this.messages.findOwn(user);
  }

  @Roles(Role.CLIENT)
  @Post()
  create(@Body() dto: CreateDirectorMessageDto, @CurrentUser() user: JwtPayload) {
    return this.messages.create(user, dto.text);
  }

  @Roles(Role.CEO)
  @Post(':id/reply')
  reply(@Param('id') id: string, @Body() dto: ReplyDirectorMessageDto, @CurrentUser() user: JwtPayload) {
    return this.messages.reply(user, id, dto.reply);
  }

  @Roles(Role.CLIENT)
  @Post('mark-seen')
  markSeen(@CurrentUser() user: JwtPayload) {
    return this.messages.markSeen(user);
  }
}
