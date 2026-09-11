import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { EmailService } from '../email/email.service';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class DirectorMessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
    private readonly email: EmailService,
  ) {}

  findAll(gymId: string) {
    return this.prisma.directorMessage.findMany({
      where: { gymId },
      include: { client: true },
      orderBy: { date: 'desc' },
    });
  }

  // Клиент видит только свою переписку.
  async findOwn(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return this.prisma.directorMessage.findMany({ where: { clientId: client.id }, orderBy: { date: 'desc' } });
  }

  async create(actor: JwtPayload, text: string) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return this.prisma.directorMessage.create({
      data: { gymId: actor.gymId, clientId: client.id, text, replySeenByClient: true },
    });
  }

  async reply(actor: JwtPayload, messageId: string, reply: string) {
    const message = await this.prisma.directorMessage.findFirst({ where: { id: messageId, gymId: actor.gymId }, include: { client: true } });
    if (!message) throw new NotFoundException('Обращение не найдено');

    const updated = await this.prisma.directorMessage.update({
      where: { id: messageId },
      data: { reply, repliedAt: new Date(), replySeenByClient: false },
    });

    await this.activityLog.log(actor, 'Ответил на обращение клиента', message.client.name, reply);
    await this.email.send(
      message.client.email,
      'Директор клуба ответил на ваше обращение — SiberianGym',
      `Здравствуйте, ${message.client.name}!\n\nВаше обращение: «${message.text}»\n\nОтвет директора: ${reply}`,
    );
    return updated;
  }

  async markSeen(actor: JwtPayload) {
    const client = await this.prisma.client.findUnique({ where: { userId: actor.sub } });
    if (!client) throw new ForbiddenException('У пользователя нет карточки клиента');
    return this.prisma.directorMessage.updateMany({
      where: { clientId: client.id, reply: { not: null }, replySeenByClient: false },
      data: { replySeenByClient: true },
    });
  }
}
