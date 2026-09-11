import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogWorkoutDto } from './dto/log-workout.dto';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class WorkoutLogsService {
  constructor(private readonly prisma: PrismaService) {}

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
