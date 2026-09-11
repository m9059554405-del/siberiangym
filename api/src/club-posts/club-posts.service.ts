import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CreateClubPostDto } from './dto/create-club-post.dto';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ClubPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLog: ActivityLogService,
  ) {}

  findAll(gymId: string) {
    return this.prisma.clubPost.findMany({ where: { gymId }, include: { media: true }, orderBy: { date: 'desc' } });
  }

  async create(actor: JwtPayload, dto: CreateClubPostDto) {
    const post = await this.prisma.clubPost.create({
      data: { gymId: actor.gymId, ...dto, authorName: 'Администрация клуба', authorRole: 'администрация клуба' },
    });
    await this.activityLog.log(actor, 'Опубликовал новость', dto.title, dto.type);
    return post;
  }
}
