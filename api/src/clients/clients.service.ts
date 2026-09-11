import { Injectable, NotFoundException } from '@nestjs/common';
import { ClientFormat, MembershipType, Tariff } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const VALIDITY_DAYS: Record<MembershipType, number | null> = {
  SINGLE: null,
  MONTHLY: 30,
  PACK10: 90,
  PACK20: 120,
};
const VISITS_TOTAL: Record<MembershipType, number | null> = {
  SINGLE: null,
  MONTHLY: null,
  PACK10: 10,
  PACK20: 20,
};

function formatForTariff(tariff: Tariff | undefined): ClientFormat {
  if (!tariff) return ClientFormat.SELF;
  return tariff === Tariff.INDIVIDUAL ? ClientFormat.PERSONAL : ClientFormat.GROUP;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(gymId: string) {
    return this.prisma.client.findMany({
      where: { gymId },
      include: { membership: true, trainer: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(gymId: string, id: string) {
    const client = await this.prisma.client.findFirst({
      where: { id, gymId },
      include: { membership: true, trainer: true, formatHistory: true },
    });
    if (!client) throw new NotFoundException('Клиент не найден');
    return client;
  }

  async create(gymId: string, dto: CreateClientDto) {
    const today = new Date();
    const format = formatForTariff(dto.tariff);
    const validityDays = VALIDITY_DAYS[dto.membershipType];
    const expiresAt = validityDays ? new Date(today.getTime() + validityDays * 86400000) : null;

    return this.prisma.client.create({
      data: {
        gymId,
        name: dto.name,
        gender: dto.gender,
        birthday: new Date(dto.birthday),
        phone: dto.phone,
        email: dto.email,
        trainerId: dto.trainerId,
        tariff: dto.tariff,
        format,
        joinedAt: today,
        membership: {
          create: {
            type: dto.membershipType,
            purchasedAt: today,
            expiresAt,
            visitsTotal: VISITS_TOTAL[dto.membershipType],
            visitsLeft: VISITS_TOTAL[dto.membershipType],
            status: 'ACTIVE',
          },
        },
        formatHistory: {
          create: { trainerId: dto.trainerId, format, from: today, to: null },
        },
      },
      include: { membership: true },
    });
  }

  async update(gymId: string, id: string, dto: UpdateClientDto) {
    await this.findOne(gymId, id);
    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.gender && { gender: dto.gender }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
      },
    });
  }
}
