// P3.12 — аварийное восстановление доступа единственного CEO. Сценарий:
// владелец забыл пароль до появления самостоятельного сброса (P3.5 уже
// есть, но email может быть недоступен), потерял устройство с 2FA (P3.6)
// или аккаунт заблокирован иным образом — управлять сетью больше некому.
//
// Скрипт запускается ТОЛЬКО с прямым доступом к прод-базе (SSH на сервер):
//   npm run prisma:emergency-ceo-reset -- --email ceo@siberiangym.ru
//   (в контейнере: node dist/prisma-seed/emergency-ceo-reset.js --email …)
//
// Что делает:
//   1. генерирует одноразовый случайный пароль (выводится один раз в
//      консоль, в логи не пишется);
//   2. обновляет passwordHash, отключает 2FA (секрет теряется вместе с
//      устройством) и поднимает sessionVersion — все старые сессии CEO
//      отзываются немедленно (P3.8);
//   3. обязательно пишет запись в activity_log с пометкой, что доступ
//      восстановлен вручную через прямой доступ к базе (требование P3.12:
//      не «тихо полезли в базу», а документируемый след);
//   4. напоминает сразу после входа сменить пароль и включить 2FA заново.
//
// Скрипт отказывается работать, если у CEO не задан email (непонятно,
// чей доступ восстанавливаем) — сначала укажите его в БД.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();

function parseFlag(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) throw new Error(`Не передан обязательный флаг --${name}`);
  const value = process.argv[i + 1];
  if (!value || value.startsWith('--')) throw new Error(`Флагу --${name} не передано значение`);
  return value;
}

async function main() {
  const email = parseFlag('email').trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Пользователь с email ${email} не найден`);
  if (user.role !== 'CEO') throw new Error(`Пользователь ${email} не является CEO (роль ${user.role})`);

  const temporaryPassword = randomBytes(12).toString('base64url');
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  const gym = await prisma.gym.findUniqueOrThrow({
    where: { id: user.gymId },
    select: { network: { select: { id: true, ownerId: true } } },
  });
  const network = gym.network;
  if (network.ownerId !== user.id) {
    throw new Error(`CEO ${email} не владеет сетью ${network.id} — восстановление доступа не имеет смысла, сначала решите вопрос владения через --set-owner скрипта network-migration`);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorEnabled: false,
        sessionVersion: { increment: 1 },
      },
    }),
    prisma.activityLogEntry.create({
      data: {
        gymId: user.gymId,
        actorId: user.id,
        actorRole: 'CEO',
        actorName: user.name ?? user.email ?? user.id,
        action: 'Аварийное восстановление доступа CEO (P3.12)',
        target: user.email ?? user.id,
        details: 'Пароль сброшен вручную через прямой доступ к базе; 2FA отключена; все сессии отозваны. Немедленно сменить пароль и включить 2FA заново.',
      },
    }),
  ]);

  console.log('Доступ CEO восстановлен. Запись об этом добавлена в журнал изменений (activity-log).');
  console.log('');
  console.log(`  Email:               ${email}`);
  console.log(`  Одноразовый пароль:  ${temporaryPassword}`);
  console.log('');
  console.log('Пароль показан только сейчас и нигде не сохранён.');
  console.log('После входа НЕМЕДЛЕННО: сменить пароль и включить 2FA заново.');
}

main()
  .catch((err) => {
    console.error(`Ошибка: ${(err as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
