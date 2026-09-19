import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

// Финансовые транзакции — видит только CEO (выручка, отчёты по тренерам).
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CEO)
@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.transactions.findAll(user);
  }

  // P4.3: CSV для бухгалтерии (вся сеть, период ?from=YYYY-MM-DD&to=YYYY-MM-DD).
  // Литеральный маршрут объявлен выше параметрических — но их здесь нет;
  // главное — он не должен конфликтовать с GET /:id, если появится.
  @Get('export')
  async exportCsv(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ) {
    const csv = await this.transactions.exportCsv(user, from, to);
    const filename = `siberiangym-transactions${from ? `-${from.slice(0, 10)}` : ''}${to ? `_${to.slice(0, 10)}` : ''}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
