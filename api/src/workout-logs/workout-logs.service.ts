import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import { assertCanViewClientData } from '../clients/client-access.util';
import { GymsService } from '../gyms/gyms.service';
import type { JwtPayload } from '../auth/auth.service';

function parseKg(load: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*кг$/.exec(load.trim());
  return m ? parseFloat(m[1]) : null;
}

function parseRepsNumber(reps: string): number {
  const range = /^(\d+)-(\d+)/.exec(reps);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const minutes = /^(\d+)\s*мин/.exec(reps);
  if (minutes) return Number(minutes[1]);
  const seconds = /(\d+)\s*сек/.exec(reps);
  if (seconds) return Number(seconds[1]) / 20;
  const plain = /^(\d+)/.exec(reps);
  if (plain) return Number(plain[1]);
  return 1;
}

export interface LeaderboardRow {
  clientId: string;
  name: string;
  avatarHue: number;
  kg: number;
}

@Injectable()
export class WorkoutLogsService {
  // P3.15: лидерборд — единственный тяжёлый агрегат проекта: разбор строк
  // «80 кг»/«8-12» по каждому подходу каждой тренировки. Синхронный JS-разбор
  // на каждый запрос блокировал event loop для всех пользователей разом.
  // Решение из бэклога «кэшировать с периодическим пересчётом»: результат
  // кэшируется в памяти на TTL (по умолчанию 60 с) — при сотне просмотров
  // рейтинга пересчёт выполняется один раз в минуту, а не сто раз. Кэш
  // in-memory: один инстанс API (до P3.18) — этого достаточно; помечено к
  // пересмотру вместе с распределённым планировщиком.
  private readonly leaderboardCache = new Map<string, { expiresAt: number; value: LeaderboardRow[] }>();
  private static readonly LEADERBOARD_TTL_MS = Number(process.env.LEADERBOARD_CACHE_TTL_MS ?? 60_000);

  constructor(private readonly prisma: PrismaService, private readonly gyms: GymsService) {}

  // Рейтинг по суммарно поднятым килограммам (вес × повторы) за период —
  // видно всем ролям в клубе, упражнения без веса (тело/кардио по времени)
  // в подсчёт не входят.
  async leaderboard(gymId: string, period: 'day' | 'week' | 'month', limit = 10): Promise<LeaderboardRow[]> {
    const cacheKey = `${gymId}:${period}:${limit}`;
    const cached = this.leaderboardCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const start = new Date(Date.now() - (days - 1) * 86400000);
    start.setHours(0, 0, 0, 0);

    // Читаются только поля, участвующие в подсчёте (load/reps/completed и
    // имя/цвет клиента) — без вложенных include целиком, объём ответа БД
    // кратно меньше (P3.15).
    const logs = await this.prisma.workoutLogEntry.findMany({
      where: { client: { gymId }, date: { gte: start }, status: { not: 'MISSED' } },
      select: {
        clientId: true,
        client: { select: { name: true, avatarHue: true } },
        exercises: { select: { sets: { select: { load: true, reps: true, completed: true } } } },
      },
    });

    const totals = new Map<string, { name: string; avatarHue: number; kg: number }>();
    for (const log of logs) {
      let kgLifted = 0;
      for (const ex of log.exercises) {
        for (const set of ex.sets) {
          if (!set.completed) continue;
          const kg = parseKg(set.load);
          if (kg === null) continue;
          kgLifted += kg * parseRepsNumber(set.reps);
        }
      }
      if (kgLifted <= 0) continue;
      const prev = totals.get(log.clientId);
      if (prev) prev.kg += kgLifted;
      else totals.set(log.clientId, { name: log.client.name, avatarHue: log.client.avatarHue, kg: kgLifted });
    }

    const value = [...totals.entries()]
      .map(([clientId, v]) => ({ clientId, name: v.name, avatarHue: v.avatarHue, kg: Math.round(v.kg) }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, limit);
    this.leaderboardCache.set(cacheKey, { expiresAt: Date.now() + WorkoutLogsService.LEADERBOARD_TTL_MS, value });
    return value;
  }

  // Посещаемость (P1.7): CEO — вся сеть одной сводкой (gymId клиента
  // приходит внутри client и используется вебом для фильтра по точке),
  // STAFF — как раньше, строго своя точка.
  async listAll(actor: JwtPayload) {
    const gymIds = actor.role === 'CEO' ? await this.gyms.resolveNetworkGymIds(actor) : [actor.gymId];
    return this.prisma.workoutLogEntry.findMany({
      where: { client: { gymId: { in: gymIds } } },
      include: { client: true, exercises: { include: { sets: true } } },
      orderBy: { date: 'desc' },
    });
  }

  // Логи конкретного клиента — только своей точки для CEO/STAFF и только
  // своего подопечного для тренера (P1.6): trainerId читается в моменте,
  // поэтому при переназначении клиента доступ старого тренера закрывается
  // сразу.
  async listForClient(actor: JwtPayload, clientId: string) {
    await assertCanViewClientData(this.prisma, actor, clientId);
    return this.prisma.workoutLogEntry.findMany({
      where: { clientId, client: { gymId: actor.gymId } },
      include: { exercises: { include: { sets: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async listOwn(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return this.listForClient(actor, client.id);
  }

  async log(actor: JwtPayload, dto: LogWorkoutDto) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');

    const allCompleted = dto.exercises.every((e) => e.sets.every((s) => s.completed));
    const anyCompleted = dto.exercises.some((e) => e.sets.some((s) => s.completed));
    const status = allCompleted ? 'COMPLETED' : anyCompleted ? 'PARTIAL' : 'MISSED';

    return this.prisma.workoutLogEntry.create({
      data: {
        clientId: client.id,
        date: new Date(),
        dayLabel: dto.dayLabel,
        status,
        exercises: {
          create: dto.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            sets: { create: e.sets.map((s) => ({ ...s })) },
          })),
        },
      },
      include: { exercises: { include: { sets: true } } },
    });
  }
}
