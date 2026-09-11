import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import type { JwtPayload } from '../auth/auth.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TrainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly auth: AuthService,
  ) {}

  async findMe(actor: JwtPayload) {
    const trainer = await this.prisma.trainer.findUnique({
      where: { userId: actor.sub },
      include: { workHours: true, credentials: true, competitionPhotos: true },
    });
    if (!trainer) throw new ForbiddenException('У пользователя нет карточки тренера');
    return trainer;
  }

  async findMyClients(actor: JwtPayload) {
    const trainer = await this.prisma.trainer.findUnique({ where: { userId: actor.sub } });
    if (!trainer) throw new ForbiddenException('У пользователя нет карточки тренера');
    return this.prisma.client.findMany({
      where: { trainerId: trainer.id },
      include: { membership: true },
      orderBy: { name: 'asc' },
    });
  }

  async createLogin(actor: JwtPayload, trainerId: string, dto: CreateLoginDto) {
    const trainer = await this.findOne(actor.gymId, trainerId);
    if (trainer.userId) throw new BadRequestException('У тренера уже есть учётная запись');
    const user = await this.auth.createUser(actor.gymId, dto.email, dto.password, 'TRAINER');
    await this.prisma.trainer.update({ where: { id: trainerId }, data: { userId: user.id } });
    await this.activityLog.log(actor, 'Выдал доступ в приложение', trainer.name, dto.email);
    return { ok: true };
  }

  findAll(gymId: string) {
    return this.prisma.trainer.findMany({
      where: { gymId },
      include: { workHours: true, credentials: true, competitionPhotos: true },
      orderBy: { createdAt: 'asc' },
    });
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
