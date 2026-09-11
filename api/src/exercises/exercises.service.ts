import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(gymId: string) {
    return this.prisma.exercise.findMany({ where: { gymId }, orderBy: { name: 'asc' } });
  }

  create(actor: JwtPayload, dto: CreateExerciseDto) {
    return this.prisma.exercise.create({ data: { gymId: actor.gymId, ...dto } });
  }
}
