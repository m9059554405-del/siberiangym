import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddCycleLogDto, AddMeasurementDto, AddProgressPhotoDto } from './dto/health.dto';
import { assertCanViewClientData } from '../clients/client-access.util';
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

  async healthcheck() {
    const startedAt = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      // P3.17/P3.20: память и аптайм процесса в каждом ответе health, чтобы
      // monitor (P3.7) и soak-тест могли строить график RSS в динамике —
      // рост без возврата между GC и есть симптом утечки. Метрики процесса
      // несекретны, поэтому остаются в публичном ответе.
      const mem = process.memoryUsage();
      const mb = (v: number) => Math.round(v / 1048576);
      return {
        status: 'ok',
        database: 'ok',
        latencyMs: Date.now() - startedAt,
        memoryMb: { rss: mb(mem.rss), heapUsed: mb(mem.heapUsed), heapTotal: mb(mem.heapTotal), external: mb(mem.external) },
        uptimeSec: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException('База данных недоступна');
    }
  }

  // Данные конкретного клиента по id — только после авторизации P1.6
  // (своя точка для CEO/STAFF, свой подопечный для тренера): замеры и фото
  // прогресса — чувствительные данные, раньше роут отдавал их по одному id.
  private listClientProgressPhotos(clientId: string) {
    return this.prisma.progressPhoto.findMany({ where: { clientId }, orderBy: { date: 'desc' } });
  }

  async listProgressPhotos(actor: JwtPayload, clientId: string) {
    await assertCanViewClientData(this.prisma, actor, clientId);
    return this.listClientProgressPhotos(clientId);
  }

  async listOwnProgressPhotos(actor: JwtPayload) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.listClientProgressPhotos(clientId);
  }

  async addProgressPhoto(actor: JwtPayload, dto: AddProgressPhotoDto) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.prisma.progressPhoto.create({ data: { clientId, ...dto } });
  }

  private listClientMeasurements(clientId: string) {
    return this.prisma.measurement.findMany({ where: { clientId }, orderBy: { date: 'asc' } });
  }

  async listMeasurements(actor: JwtPayload, clientId: string) {
    await assertCanViewClientData(this.prisma, actor, clientId);
    return this.listClientMeasurements(clientId);
  }

  async listOwnMeasurements(actor: JwtPayload) {
    const clientId = await resolveOwnClientId(this.prisma, actor);
    return this.listClientMeasurements(clientId);
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
