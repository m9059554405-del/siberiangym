import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { ExercisesService } from './exercises.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.exercises.findAll(user.gymId);
  }

  @Roles(Role.CEO, Role.STAFF, Role.TRAINER)
  @Post()
  create(@Body() dto: CreateExerciseDto, @CurrentUser() user: JwtPayload) {
    return this.exercises.create(user, dto);
  }
}
