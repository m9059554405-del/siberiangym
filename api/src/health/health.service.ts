import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCycleLogDto, AddMeasurementDto, AddProgressPhotoDto } from './dto/health.dto';
import type { JwtPayload } from '../auth/auth.service';

// Все self-service методы этого сервиса действуют строго от лица
// собственной карточки клиента — резолвится по userId из токена.
async function resolveOwnClientId(prisma: PrismaService, actor: JwtPayload): Promise<string> {
  const client = await prisma.client.findUnique({ where: { userId: actor.sub } });
  if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
  return client.id;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  listProgressPhotos(clientId: string) {
    return this.prisma.progressPhoto.findMany({ where: { clientId }, orderBy: { date: 'desc' } });
  }

  async listOwnProgressPhotos(actor: JwtPayload) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.listProgressPhotos(clientId);
  }

  async addProgressPhoto(actor: JwtPayload, dto: AddProgressPhotoDto) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.prisma.progressPhoto.create({ data: { clientId, ...dto } });
  }

  listMeasurements(clientId: string) {
    return this.prisma.measurement.findMany({ where: { clientId }, orderBy: { date: 'asc' } });
  }

  async listOwnMeasurements(actor: JwtPayload) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.listMeasurements(clientId);
  }

  async addMeasurement(actor: JwtPayload, dto: AddMeasurementDto) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.prisma.measurement.create({ data: { clientId, ...dto } });
  }

  listCycleLogs(clientId: string) {
    return this.prisma.cycleLog.findMany({ where: { clientId }, orderBy: { date: 'desc' } });
  }

  async listOwnCycleLogs(actor: JwtPayload) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.listCycleLogs(clientId);
  }

  async addCycleLog(actor: JwtPayload, dto: AddCycleLogDto) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.prisma.cycleLog.create({ data: { clientId, date: dto.date ? new Date(dto.date) : new Date() } });
  }
}
