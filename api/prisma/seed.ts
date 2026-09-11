// Создаёт зал SiberianGym и первого CEO, чтобы был с чем войти в систему
// сразу после установки. Остальные учётные записи (тренеры, администраторы)
// CEO заводит сам через POST /api/auth/users после входа.
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EXERCISE_LIBRARY } from './exercise-library';

const prisma = new PrismaClient();

const CEO_EMAIL = process.env.SEED_CEO_EMAIL ?? 'ceo@siberiangym.ru';
const CEO_PASSWORD = process.env.SEED_CEO_PASSWORD ?? 'change-me-12345';

async function main() {
  const existing = await prisma.gym.findFirst({ where: { name: 'SiberianGym' } });
  const gym = existing ?? (await prisma.gym.create({ data: { name: 'SiberianGym' } }));

  const existingCeo = await prisma.user.findUnique({ where: { email: CEO_EMAIL } });
  if (!existingCeo) {
    const passwordHash = await bcrypt.hash(CEO_PASSWORD, 12);
    await prisma.user.create({
      data: { gymId: gym.id, email: CEO_EMAIL, passwordHash, role: 'CEO' },
    });
    console.log(`Создан CEO: ${CEO_EMAIL} / ${CEO_PASSWORD} — смените пароль после первого входа.`);
  } else {
    console.log(`CEO ${CEO_EMAIL} уже существует, пропускаю.`);
  }

  const existingPricing = await prisma.membershipPricing.findUnique({ where: { gymId: gym.id } });
  if (!existingPricing) {
    await prisma.membershipPricing.create({
      data: {
        gymId: gym.id,
        single: 900,
        monthly: 4500,
        pack10: 8000,
        pack20: 14000,
        personalSingle: 2200,
        personalPack5: 9000,
        groupSingle: 700,
        groupMonthly: 3500,
      },
    });
  }

  const existingExercises = await prisma.exercise.count({ where: { gymId: gym.id } });
  if (existingExercises === 0) {
    await prisma.exercise.createMany({
      data: EXERCISE_LIBRARY.map((e) => ({ gymId: gym.id, ...e })),
    });
    console.log(`Добавлена библиотека упражнений: ${EXERCISE_LIBRARY.length} шт.`);
  } else {
    console.log(`Библиотека упражнений уже заполнена (${existingExercises} шт.), пропускаю.`);
  }

  console.log(`Готово. Зал: ${gym.name} (${gym.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
