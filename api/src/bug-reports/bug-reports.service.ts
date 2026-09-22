import { Injectable, NotFoundException } from '@nestjs/common';
import { BugReportStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBugReportDto } from './dto/create-bug-report.dto';
import type { UpdateBugReportDto } from './dto/update-bug-report.dto';

const reportInclude = {
  gym: { select: { id: true, name: true } },
  reporter: { select: { id: true, email: true, name: true, role: true } },
  resolvedBy: { select: { id: true, email: true, name: true } },
} satisfies Prisma.BugReportInclude;

@Injectable()
export class BugReportsService {
  constructor(private readonly prisma: PrismaService) {}

  create(actor: JwtPayload, dto: CreateBugReportDto, screenshot?: Express.Multer.File) {
    return this.prisma.bugReport.create({
      data: {
        gymId: actor.gymId,
        reporterId: actor.sub,
        problem: dto.problem.trim(),
        expected: dto.expected.trim(),
        telemetry: dto.telemetry as Prisma.InputJsonValue,
        screenshot: screenshot ? Uint8Array.from(screenshot.buffer) : undefined,
        screenshotMime: screenshot?.mimetype,
      },
      select: { id: true, status: true, createdAt: true },
    });
  }

  findAll(status?: BugReportStatus) {
    return this.prisma.bugReport.findMany({
      where: status ? { status } : undefined,
      include: reportInclude,
      omit: { screenshot: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const report = await this.prisma.bugReport.findUnique({
      where: { id },
      include: reportInclude,
      omit: { screenshot: true },
    });
    if (!report) throw new NotFoundException('Багрепорт не найден');
    return report;
  }

  async screenshot(id: string) {
    const report = await this.prisma.bugReport.findUnique({
      where: { id },
      select: { screenshot: true, screenshotMime: true },
    });
    if (!report) throw new NotFoundException('Багрепорт не найден');
    if (!report.screenshot) throw new NotFoundException('Снимок экрана отсутствует');
    return { buffer: report.screenshot, mime: report.screenshotMime ?? 'image/png' };
  }

  async update(actor: JwtPayload, id: string, dto: UpdateBugReportDto) {
    await this.findOne(id);
    const closed = dto.status === BugReportStatus.RESOLVED || dto.status === BugReportStatus.REJECTED;
    return this.prisma.bugReport.update({
      where: { id },
      data: {
        status: dto.status,
        resolutionNote: dto.resolutionNote?.trim() || null,
        resolvedById: closed ? actor.sub : null,
        resolvedAt: closed ? new Date() : null,
      },
      include: reportInclude,
      omit: { screenshot: true },
    });
  }
}
