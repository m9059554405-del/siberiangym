import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { JwtPayload } from './auth.service';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  // Заводить новые учётные записи (тренер/администратор/CEO) может только CEO.
  // Клиентские карточки создаются через модуль clients, с логином не связаны напрямую.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CEO)
  @Post('users')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtPayload) {
    return this.auth.createUser(actor.gymId, dto.email, dto.password, dto.role, dto.phone);
  }
}
