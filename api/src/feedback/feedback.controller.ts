import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients/:clientId/feedback')
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  find(@Param('clientId') clientId: string, @CurrentUser() user: JwtPayload) {
    return this.feedback.findForClient(user.gymId, clientId);
  }

  @Post()
  create(@Param('clientId') clientId: string, @Body() dto: CreateFeedbackDto, @CurrentUser() user: JwtPayload) {
    return this.feedback.create(user, clientId, dto.text);
  }
}
