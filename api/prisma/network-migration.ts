// P1.9 — явный migration-скрипт введения сети (Network) на реальной
// прод-базе. SiberianGym работает на проде с настоящими клиентами,
// тренерами и транзакциями, поэтому SQL-бэкфилл внутри миграции P1.1
// (создать Network с ownerId текущего CEO и привязать единственный Gym)
// недостаточно прогонять молча: нужен отчёт, который видно глазами, и
// проверки, что ни одна строка клиентских данных не потеряла связь с
// залом и ни один пользователь не заметил простоя.
//
// Порядок прогона на КОПИИ прод-базы перед выкладкой на прод:
//   1. восстановить дамп в отдельную базу, указать её в DATABASE_URL;
//   2. npm run prisma:deploy   — применит все миграции, включая бэкфилл P1.1;
//   3. npm run prisma:network-migration — этот скрипт: отчёт + проверки;
//   4. при необходимости починить владельца: --set-owner ceo@... и
//      перезапустить проверку;
//   5. только после чистого прогона — те же шаги на проде.
//
// Скрипт идемпотентен: без флагов ничего не меняет (read-only), повторный
// прогон безопасен. Код выхода: 0 — всё чисто, 1 — найдены проблемы.
//
// Флаги (работают только когда сеть ровно одна — прод-сценарий P1.9):
//   --set-owner <email>  перепривязать Network.ownerId к этому CEO
//                        (роль проверяется; владельцев-не-CEO скрипт
//                        заводить отказывается);
//   --name <название>    переименовать сеть (по умолчанию бэкфилл P1.1
//                        называет её именем зала).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Таблицы, связь которых с залом обязана уцелеть (P1.9 называет
// Client/Trainer/Transaction и пользователей; заказы и расписание — тот
// же класс «деньги и занятия», проверяем вместе с ними).
const GYM_SCOPED_TABLES = [
  'users',
  'clients',
  'trainers',
  'transactions',
  'orders',
  'group_classes',
  'personal_slots',
] as const;

function parseFlag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const value = process.argv[i + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Флагу --${name} не передано значение`);
  }
  return value;
}

async function orphanCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of GYM_SCOPED_TABLES) {
    // Имена таблиц — константы выше, не пользовательский ввод.
    const rows = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::int AS count FROM "${table}" WHERE "gym_id" NOT IN (SELECT "id" FROM "gyms")`,
    );
    counts[table] = Number(rows[0]?.count ?? 0);
  }
  return counts;
}

async function main() {
  const setOwnerEmail = parseFlag('set-owner');
  const networkName = parseFlag('name');

  const networks = await prisma.network.findMany({ orderBy: { createdAt: 'asc' } });
  const gyms = await prisma.gym.findMany({ orderBy: { createdAt: 'asc' } });

  console.log('=== P1.9: сеть на прод-базе — отчёт migration-скрипта ===\n');
  console.log(`Сетей: ${networks.length}, залов: ${gyms.length}`);

  const problems: string[] = [];

  // --- Починка (до проверок, чтобы финальный отчёт уже видел результат) ---
  if (setOwnerEmail || networkName) {
    if (networks.length !== 1) {
      throw new Error(`Флаги --set-owner/--name рассчитаны на прод-сценарий "ровно одна сеть", найдено сетей: ${networks.length}.`);
    }
    const network = networks[0];
    if (setOwnerEmail) {
      const owner = await prisma.user.findUnique({ where: { email: setOwnerEmail } });
      if (!owner || owner.role !== 'CEO') {
        throw new Error(`Пользователь ${setOwnerEmail} не найден или не является CEO — владельцем сети может быть только CEO`);
      }
      await prisma.network.update({ where: { id: network.id }, data: { ownerId: owner.id } });
      console.log(`Владелец сети перепривязан: ${setOwnerEmail} (${owner.id})\n`);
      networks[0] = await prisma.network.findUniqueOrThrow({ where: { id: network.id } });
    }
    if (networkName) {
      await prisma.network.update({ where: { id: network.id }, data: { name: networkName } });
      console.log(`Сеть переименована: ${networkName}\n`);
      networks[0] = await prisma.network.findUniqueOrThrow({ where: { id: network.id } });
    }
  }

  // --- Сеть -> владелец -> залы ---
  for (const network of networks) {
    console.log(`\nСеть "${network.name}" (${network.id})`);
    const owner = await prisma.user.findUnique({ where: { id: network.ownerId } });
    if (!owner) {
      problems.push(`Сеть "${network.name}": владелец ${network.ownerId} не найден в users (ownerId без FK — ссылка могла осиротеть; чинится --set-owner <email текущего CEO>)`);
      console.log(`  ВЛАДЕЛЕЦ: ${network.ownerId} — НЕ НАЙДЕН`);
    } else {
      console.log(`  Владелец: ${owner.email ?? owner.id} (роль ${owner.role})`);
      if (owner.role !== 'CEO') {
        problems.push(`Сеть "${network.name}": владелец ${owner.email ?? owner.id} имеет роль ${owner.role}, а не CEO (чинится --set-owner <email текущего CEO>)`);
      }
    }
    const networkGyms = gyms.filter((g) => g.networkId === network.id);
    console.log(`  Залов: ${networkGyms.length} — ${networkGyms.map((g) => `${g.name} (${g.id})`).join(', ') || 'НЕТ'}`);
    if (networkGyms.length === 0) {
      problems.push(`Сеть "${network.name}": к ней не привязан ни один зал`);
    }
  }

  const networkIds = new Set(networks.map((n) => n.id));
  const gymsWithoutNetwork = gyms.filter((g) => !networkIds.has(g.networkId));
  if (gymsWithoutNetwork.length > 0) {
    problems.push(`Залы без сети: ${gymsWithoutNetwork.map((g) => g.name).join(', ')}`);
  }

  // --- Данные на месте: связь строк с залом не потеряна ---
  console.log('\nСтрок по залам (связь gym_id должна уцелеть):');
  for (const gym of gyms) {
    const counts = await prisma.$queryRawUnsafe<Record<string, bigint>[]>(
      `SELECT
        (SELECT COUNT(*) FROM "users" WHERE "gym_id" = $1) AS users,
        (SELECT COUNT(*) FROM "clients" WHERE "gym_id" = $1) AS clients,
        (SELECT COUNT(*) FROM "trainers" WHERE "gym_id" = $1) AS trainers,
        (SELECT COUNT(*) FROM "transactions" WHERE "gym_id" = $1) AS transactions,
        (SELECT COUNT(*) FROM "orders" WHERE "gym_id" = $1) AS orders`,
      gym.id,
    );
    const row = counts[0];
    console.log(
      `  ${gym.name}: пользователей ${row.users}, клиентов ${row.clients}, тренеров ${row.trainers}, транзакций ${row.transactions}, заказов ${row.orders}`,
    );
    const pricing = await prisma.membershipPricing.findUnique({ where: { gymId: gym.id } });
    if (!pricing) {
      problems.push(`Зал "${gym.name}": нет строки MembershipPricing — продажа абонементов на нём невозможна (P1.2 требует цен на точке)`);
    }
  }

  // --- Осиротевшие строки (gym_id указывает в никуда) ---
  console.log('\nОсиротевшие строки (gym_id без существующего зала):');
  const orphans = await orphanCounts();
  for (const [table, count] of Object.entries(orphans)) {
    console.log(`  ${table}: ${count}`);
    if (count > 0) {
      problems.push(`Таблица "${table}" содержит ${count} строк с несуществующим gym_id — данные оторваны от зала`);
    }
  }

  // --- Итог ---
  console.log('');
  if (problems.length > 0) {
    console.log('НАЙДЕНЫ ПРОБЛЕМЫ:');
    for (const p of problems) console.log(`  - ${p}`);
    console.log('\nПрод не обновлять, пока отчёт не чист (см. --set-owner / разбор дампа).');
    process.exitCode = 1;
  } else {
    console.log('OK: каждая сеть имеет владельца-CEO, каждый зал принадлежит сети, клиентские данные на месте.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
