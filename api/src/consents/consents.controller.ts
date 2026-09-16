import { Body, Controller, Get, Param, ParseEnumPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ConsentType, Role } from '@prisma/client';
import { ConsentsService } from './consents.service';
import { DeletionRequestDto, GrantConsentDto } from './dto/consent.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

function userAgentOf(req: Request): string | undefined {
  const ua = req.headers['user-agent'];
  return Array.isArray(ua) ? ua[0] : ua;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('consents')
export class ConsentsController {
  constructor(private readonly consents: ConsentsService) {}

  // Тексты согласий — читает любая авторизованная роль (не содержат ничего
  // чувствительного, нужны фронту ещё до того, как известно, чего клиенту не хватает).
  @Get('texts')
  getTexts() {
    return this.consents.getTexts();
  }

  @Roles(Role.CLIENT)
  @Get('mine')
  getMine(@CurrentUser() user: JwtPayload) {
    return this.consents.getMyStatus(user);
  }

  @Roles(Role.CLIENT)
  @Post('grant')
  grant(@Body() dto: GrantConsentDto, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.consents.grant(user, dto.type, req.ip, userAgentOf(req));
  }

  @Roles(Role.CLIENT)
  @Post(':type/revoke')
  revoke(
    @Param('type', new ParseEnumPipe(ConsentType)) type: ConsentType,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.consents.revoke(user, type, req.ip, userAgentOf(req));
  }

  @Roles(Role.CLIENT)
  @Get('export')
  exportData(@CurrentUser() user: JwtPayload) {
    return this.consents.exportData(user);
  }

  @Roles(Role.CLIENT)
  @Post('delete-request')
  requestDeletion(@Body() dto: DeletionRequestDto, @CurrentUser() user: JwtPayload) {
    return this.consents.requestDeletion(user, dto.reason);
  }

  // Аудит для CEO/STAFF — подтверждение, что нужные формы подписаны, без
  // необходимости лезть в базу руками.
  @Roles(Role.CEO, Role.STAFF)
  @Get('client/:clientId')
  getForClient(@Param('clientId') clientId: string, @CurrentUser() user: JwtPayload) {
    return this.consents.getClientStatus(user, clientId);
  }
}
