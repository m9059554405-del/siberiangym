import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
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

@Injectable()
export class WorkoutLogsService {
  constructor(private readonly prisma: PrismaService) {}

  // Рейтинг по суммарно поднятым килограммам (вес × повторы) за период —
  // видно всем ролям в клубе, упражнения без веса (тело/кардио по времени)
  // в подсчёт не входят.
  async leaderboard(gymId: string, period: 'day' | 'week' | 'month', limit = 10) {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
    const start = new Date(Date.now() - (days - 1) * 86400000);
    start.setHours(0, 0, 0, 0);

    const logs = await this.prisma.workoutLogEntry.findMany({
      where: { client: { gymId }, date: { gte: start }, status: { not: 'MISSED' } },
      include: { client: true, exercises: { include: { sets: true } } },
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

    return [...totals.entries()]
      .map(([clientId, v]) => ({ clientId, name: v.name, avatarHue: v.avatarHue, kg: Math.round(v.kg) }))
      .sort((a, b) => b.kg - a.kg)
      .slice(0, limit);
  }

  listAll(gymId: string) {
    return this.prisma.workoutLogEntry.findMany({
      where: { client: { gymId } },
      include: { client: true, exercises: { include: { sets: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async listForClient(gymId: string, clientId: string) {
    return this.prisma.workoutLogEntry.findMany({
      where: { clientId, client: { gymId } },
      include: { exercises: { include: { sets: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async listOwn(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return this.listForClient(actor.gymId, client.id);
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
