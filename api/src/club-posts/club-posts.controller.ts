import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ClubPostsService } from './club-posts.service';
import { CreateClubPostDto } from './dto/create-club-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('club-posts')
export class ClubPostsController {
  constructor(private readonly posts: ClubPostsService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.posts.findAll(user.gymId);
  }

  @Roles(Role.CEO, Role.STAFF)
  @Post()
  create(@Body() dto: CreateClubPostDto, @CurrentUser() user: JwtPayload) {
    return this.posts.create(user, dto);
  }
}
