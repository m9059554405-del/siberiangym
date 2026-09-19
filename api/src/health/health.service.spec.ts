import { ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';

describe('HealthService.healthcheck', () => {
  const prismaOk: any = { $queryRaw: jest.fn().mockResolvedValue([]) };

  it('отдаёт ok с метриками памяти и аптаймом для P3.17/P3.20', async () => {
    const result = await new HealthService(prismaOk).healthcheck();

    expect(result.status).toBe('ok');
    expect(result.database).toBe('ok');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.uptimeSec).toBeGreaterThanOrEqual(0);
    for (const key of ['rss', 'heapUsed', 'heapTotal', 'external'] as const) {
      expect(Number.isInteger(result.memoryMb[key])).toBe(true);
      expect(result.memoryMb[key]).toBeGreaterThan(0);
    }
    expect(result.memoryMb.heapUsed).toBeLessThanOrEqual(result.memoryMb.rss);
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('недоступная база превращается в 503, а не в падение процесса', async () => {
    const prismaDown: any = { $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')) };

    await expect(new HealthService(prismaDown).healthcheck()).rejects.toThrow(ServiceUnavailableException);
  });
});
