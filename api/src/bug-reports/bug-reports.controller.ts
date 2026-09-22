import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BugReportStatus, Role } from '@prisma/client';
import type { Response } from 'express';
import type { JwtPayload } from '../auth/auth.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BugReportsService } from './bug-reports.service';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { UpdateBugReportDto } from './dto/update-bug-report.dto';

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bug-reports')
export class BugReportsController {
  constructor(private readonly bugReports: BugReportsService) {}

  @Roles(Role.CLIENT, Role.TRAINER, Role.CEO, Role.STAFF)
  @Post()
  @UseInterceptors(FileInterceptor('screenshot', { limits: { fileSize: MAX_SCREENSHOT_SIZE } }))
  create(@CurrentUser() actor: JwtPayload, @Body() dto: CreateBugReportDto, @UploadedFile() screenshot?: Express.Multer.File) {
    if (screenshot && !SCREENSHOT_TYPES.has(screenshot.mimetype)) {
      throw new BadRequestException('Допустимы снимки PNG, JPEG или WebP');
    }
    return this.bugReports.create(actor, dto, screenshot);
  }

  @Roles(Role.SYSADMIN)
  @Get()
  findAll(@Query('status') status?: BugReportStatus) {
    if (status && !Object.values(BugReportStatus).includes(status)) {
      throw new BadRequestException('Неизвестный статус багрепорта');
    }
    return this.bugReports.findAll(status);
  }

  @Roles(Role.SYSADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bugReports.findOne(id);
  }

  @Roles(Role.SYSADMIN)
  @Get(':id/screenshot')
  async screenshot(@Param('id') id: string, @Res() response: Response) {
    const screenshot = await this.bugReports.screenshot(id);
    response.type(screenshot.mime).send(screenshot.buffer);
  }

  @Roles(Role.SYSADMIN)
  @Patch(':id')
  update(@CurrentUser() actor: JwtPayload, @Param('id') id: string, @Body() dto: UpdateBugReportDto) {
    return this.bugReports.update(actor, id, dto);
  }
}
