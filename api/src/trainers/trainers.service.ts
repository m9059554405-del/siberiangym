import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainerDto } from './dto/create-trainer.dto';
import { CreateLoginDto } from './dto/create-login.dto';
import type { JwtPayload } from '../auth/auth.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AuthService } from '../auth/auth.service';
import { EmailService } from '../email/email.service';
import { GymsService } from '../gyms/gyms.service';

@Injectable()
export class TrainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly auth: AuthService,
    private readonly email: EmailService,
    private readonly gyms: GymsService,
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
    await this.email.send(
      dto.email,
      'Доступ в приложение SiberianGym',
      `Здравствуйте, ${trainer.name}!\n\nВам открыт доступ в личный кабинет SiberianGym.\nEmail для входа: ${dto.email}\nПароль: ${dto.password}\n\nРекомендуем сменить пароль после первого входа.`,
    );
    return { ok: true };
  }

  // "На этой точке" (P1.3) значит: домашняя точка ИЛИ явно назначенная
  // дополнительная (TrainerGym) — тренер продолжает работать как раньше,
  // если у него вообще нет ни одной дополнительной точки.
  private static scopeToGym(gymId: string) {
    return { OR: [{ gymId }, { additionalGyms: { some: { gymId } } }] };
  }

  findAll(gymId: string) {
    return this.prisma.trainer.findMany({
      where: TrainersService.scopeToGym(gymId),
      include: { workHours: true, credentials: true, competitionPhotos: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(gymId: string, id: string) {
    const trainer = await this.prisma.trainer.findFirst({
      where: { id, ...TrainersService.scopeToGym(gymId) },
      include: { clients: true, workHours: true, credentials: true, competitionPhotos: true },
    });
    if (!trainer) throw new NotFoundException('Тренер не найден');
    return trainer;
  }

  // Используется расписанием (schedule.service.ts) — та же проверка "тренер
  // реально работает на этой точке", не только владелец её создаёт.
  async assertTrainerAtGym(trainerId: string, gymId: string) {
    const trainer = await this.prisma.trainer.findFirst({ where: { id: trainerId, ...TrainersService.scopeToGym(gymId) } });
    if (!trainer) throw new NotFoundException('Тренер не найден на этой точке');
    return trainer;
  }

  // Список точек тренера (домашняя + дополнительные) — для карточки в CEO-кабинете.
  async listGyms(actor: JwtPayload, trainerId: string) {
    const trainer = await this.findOne(actor.gymId, trainerId);
    const additional = await this.prisma.trainerGym.findMany({ where: { trainerId }, include: { gym: true } });
    return { homeGymId: trainer.gymId, additional: additional.map((a) => a.gym) };
  }

  // Назначение на дополнительную точку сети (P1.3) — только точки СВОЕЙ
  // сети (проверяется через networkId, а не по параметру запроса).
  async assignToGym(actor: JwtPayload, trainerId: string, gymId: string) {
    await this.gyms.assertBelongsToOwnedNetwork(actor, gymId);
    const trainer = await this.findOne(actor.gymId, trainerId);
    if (trainer.gymId === gymId) throw new BadRequestException('Это и так домашняя точка тренера');
    await this.prisma.trainerGym.upsert({
      where: { trainerId_gymId: { trainerId, gymId } },
      create: { trainerId, gymId },
      update: {},
    });
    await this.activityLog.log(actor, 'Назначил тренера на точку сети', trainer.name, `id точки: ${gymId}`);
    return { ok: true };
  }

  async unassignFromGym(actor: JwtPayload, trainerId: string, gymId: string) {
    const trainer = await this.findOne(actor.gymId, trainerId);
    await this.prisma.trainerGym.delete({ where: { trainerId_gymId: { trainerId, gymId } } }).catch(() => {});
    await this.activityLog.log(actor, 'Снял тренера с точки сети', trainer.name, `id точки: ${gymId}`);
    return { ok: true };
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
