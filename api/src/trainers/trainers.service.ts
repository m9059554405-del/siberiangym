import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import type { JwtPayload } from '../auth/auth.service';
import { ActivityLogService } from '../activity-log/activity-log.service';

@Injectable()
export class TrainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  findAll(gymId: string) {
    return this.prisma.trainer.findMany({ where: { gymId }, orderBy: { createdAt: 'asc' } });
  }

  async findOne(gymId: string, id: string) {
    const trainer = await this.prisma.trainer.findFirst({
      where: { id, gymId },
      include: { clients: true, workHours: true, credentials: true, competitionPhotos: true },
    });
    if (!trainer) throw new NotFoundException('Тренер не найден');
    return trainer;
  }

  async create(actor: JwtPayload, dto: CreateTrainerDto) {
    const trainer = await this.prisma.trainer.create({
      data: {
        gymId: actor.gymId,
        name: dto.name,
        specialization: dto.specialization,
        bio: dto.bio,
        experienceYears: dto.experienceYears ?? 0,
        personalSessionPrice: dto.personalSessionPrice,
        avatarHue: Math.floor(Math.random() * 360),
      },
    });
    await this.activityLog.log(actor, 'Добавил тренера', trainer.name, dto.specialization);
    return trainer;
  }
}
