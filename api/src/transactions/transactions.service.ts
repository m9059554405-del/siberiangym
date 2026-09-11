import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(gymId: string) {
    return this.prisma.transaction.findMany({
      where: { gymId },
      include: { client: true, trainer: true },
      orderBy: { date: 'desc' },
    });
  }
}
