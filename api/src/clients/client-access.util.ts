import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';

// P1.6 «своя точка vs чужая точка сети» + мгновенный отзыв доступа тренера.
// Единая проверка для эндпоинтов, отдающих данные КОНКРЕТНОГО клиента по
// id из запроса (workout-логи, замеры, фото прогресса):
// - CEO/STAFF — клиент именно своей точки: чужая точка сети не должна
//   открываться подбором ID (те же принципы, что в self-service фиксах 0.5.0);
// - TRAINER — только собственный подопечный. trainerId читается в моменте,
//   поэтому при переназначении клиента другому тренеру (TARIFF_CHANGE /
//   возврат тарифа) доступ старого тренера закрывается сразу, а не по
//   инерции старой связи;
// - CLIENT — только собственная карточка (на этих роутах роль не встреча-
//   ется, проверка оставлена для защиты от будущих изменений декораторов).
export async function assertCanViewClientData(prisma: PrismaService, actor: JwtPayload, clientId: string): Promise<void> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, gymId: actor.gymId },
    select: { userId: true, trainerId: true },
  });
  if (!client) throw new NotFoundException('Клиент не найден');
  if (actor.role === 'TRAINER') {
    const trainer = await prisma.trainer.findUnique({ where: { userId: actor.sub } });
    if (!trainer || client.trainerId !== trainer.id) {
      throw new ForbiddenException('Можно смотреть только своих подопечных');
    }
  }
  if (actor.role === 'CLIENT' && client.userId !== actor.sub) {
    throw new ForbiddenException('Недостаточно прав для этого действия');
  }
}
