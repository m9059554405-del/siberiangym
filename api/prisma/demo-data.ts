import { PrismaClient, Trainer, Client, CatalogItem, Membership, User } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260917)
const ri = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1))
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

const DAY = 86400000
const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
const dayAt = (offset: number) => new Date(today.getTime() + offset * DAY)

// Точка выбирается явно: DEMO_GYM_ID надёжнее (имена не уникальны), но для
// ручного прогона достаточно DEMO_GYM_NAME. Дефолт — историческое имя
// демо-точки из seed.ts.
const gymWhere = process.env.DEMO_GYM_ID
  ? { id: process.env.DEMO_GYM_ID }
  : { name: process.env.DEMO_GYM_NAME ?? 'SiberianGym' }

// Демо-администраторы: login-учётки STAFF (пароль общий у трёх демо-аккаунтов,
// выдаётся разработчиком/демонстратором вручную — в БД только bcrypt-хэш).
const STAFF_PASSWORD = 'Staff2026!Gym'
const STAFF_DEFS = [
  { email: 'staff1@siberiangym.ru', name: 'Ирина Воронцова' },
  { email: 'staff2@siberiangym.ru', name: 'Павел Сазонов' },
  { email: 'staff3@siberiangym.ru', name: 'Дина Абрамова' },
]

const TRAINER_DEFS = [
  { name: 'Максим Ветров', spec: 'Силовая подготовка', emp: 'EMPLOYEE', exp: 8, price: 2500, share: 40, hue: 214, hours: [[1, 9, 18], [3, 9, 18], [5, 9, 18], [2, 12, 21], [4, 12, 21], [6, 10, 16]] },
  { name: 'Елена Снегирёва', spec: 'Йога и стретчинг', emp: 'SELF_EMPLOYED', exp: 6, price: 2000, share: 35, hue: 340, hours: [[2, 10, 19], [4, 10, 19], [6, 10, 15]] },
  { name: 'Дмитрий Тайгин', spec: 'Кроссфит', emp: 'EMPLOYEE', exp: 5, price: 2400, share: 40, hue: 150, hours: [[1, 12, 21], [3, 12, 21], [5, 12, 21], [6, 11, 17]] },
  { name: 'Анна Полярная', spec: 'Функциональный тренинг', emp: 'SOLE_PROPRIETOR', exp: 7, price: 2200, share: 38, hue: 40, hours: [[1, 8, 17], [3, 8, 17], [5, 8, 17]] },
  { name: 'Игорь Морозов', spec: 'Бокс и единоборства', emp: 'SELF_EMPLOYED', exp: 9, price: 2300, share: 40, hue: 262, hours: [[2, 14, 21], [5, 14, 21], [6, 12, 18]] },
  { name: 'Ольга Леднёва', spec: 'Снижение веса и ЛФК', emp: 'EMPLOYEE', exp: 4, price: 2100, share: 35, hue: 300, hours: [[2, 9, 18], [4, 9, 18], [6, 9, 15]] },
  { name: 'Сергей Бурый', spec: 'Пауэрлифтинг', emp: 'EMPLOYEE', exp: 10, price: 2600, share: 45, hue: 20, hours: [[1, 15, 21], [3, 15, 21], [5, 15, 21]] },
] as const

const MALE_NAMES = ['Артём Волков', 'Никита Заров', 'Пётр Ильин', 'Роман Гусев', 'Кирилл Дёмин', 'Егор Платов', 'Иван Сажин', 'Андрей Черныш', 'Влад Ким', 'Тимур Баскаков', 'Данил Орехов', 'Фёдор Лапин', 'Григорий Смолин', 'Олег Тарасов', 'Юрий Вьюгин', 'Артур Сафин', 'Павел Углов', 'Степан Речнов', 'Марк Дорохов', 'Лев Журавлёв', 'Богдан Сычёв', 'Захар Паньков']
const FEMALE_NAMES = ['Мария Снежная', 'Алина Фомина', 'Дарья Ясная', 'Ксения Луговая', 'Вера Мороз', 'Полина Тайрова', 'Софья Градова', 'Ульяна Полянова', 'Екатерина Хрусталёва', 'Ирина Весенняя', 'Наталья Гаевская', 'Татьяна Микулина', 'Анна Стрельцова', 'Вероника Зимина', 'Людмила Пыхтина', 'Кристина Ольхова', 'Юлия Сойкина', 'Светлана Кедрова', 'Надежда Рыбакова', 'Галина Северова', 'Алёна Черёмухина', 'Влада Истомина']

const CATALOG: Array<[string, 'FOOD' | 'WATER', number, string, number, number]> = [
  ['Протеиновый коктейль «Ваниль»', 'FOOD', 350, '🥛', 16, 60],
  ['Протеиновый коктейль «Шоколад»', 'FOOD', 350, '🥛', 14, 55],
  ['Гейнер (порция)', 'FOOD', 320, '🥤', 10, 48],
  ['BCAA (порция)', 'FOOD', 300, '💪', 12, 44],
  ['Креатин (порция)', 'FOOD', 250, '⚡', 9, 50],
  ['Изотоник (готовый)', 'FOOD', 200, '🧃', 18, 70],
  ['Протеиновый батончик', 'FOOD', 180, '🍫', 22, 90],
  ['L-карнитин (порция)', 'FOOD', 260, '🔥', 8, 36],
  ['Аминокислотный комплекс', 'FOOD', 280, '💊', 7, 30],
  ['Энергетик без сахара', 'FOOD', 250, '⚡', 12, 40],
  ['Вода питьевая 0,5 л', 'WATER', 80, '💧', 30, 120],
  ['Вода питьевая 1,5 л', 'WATER', 120, '💧', 24, 80],
]

const CLASS_TEMPLATES: Array<{ type: string; trainer: number; zone: string; start: string; end: string; days: number[] }> = [
  { type: 'Кроссфит-микс', trainer: 2, zone: 'Зал А', start: '18:00', end: '19:00', days: [1, 3, 5] },
  { type: 'Йога', trainer: 1, zone: 'Зал Б', start: '10:00', end: '11:00', days: [2, 4, 6] },
  { type: 'Стретчинг', trainer: 1, zone: 'Зал Б', start: '19:30', end: '20:30', days: [1, 4] },
  { type: 'Бокс для начинающих', trainer: 4, zone: 'Ринг-зона', start: '19:00', end: '20:00', days: [2, 5] },
  { type: 'Функциональная тренировка', trainer: 3, zone: 'Зал А', start: '08:00', end: '09:00', days: [1, 3, 5] },
  { type: 'Утренний фитнес', trainer: 5, zone: 'Кардио-зона', start: '09:00', end: '10:00', days: [2, 4, 6] },
  { type: 'Силовой блок', trainer: 0, zone: 'Зал А', start: '20:00', end: '21:00', days: [3, 6] },
  { type: 'Пауэрлифтинг: техника', trainer: 6, zone: 'Тяжёлая зона', start: '18:30', end: '19:30', days: [1, 5] },
]

const SLOT_HOUR_POOLS = [[10, 14, 18, 20], [11, 15, 19, 12], [12, 16, 19, 10], [9, 13, 17, 11], [14, 17, 20, 16], [10, 13, 16, 18], [15, 18, 20, 13]]

const MEMBERSHIP_LABEL: Record<string, string> = { MONTHLY: 'Месячный', PACK10: '10 занятий', PACK20: '20 занятий', SINGLE: 'Разовый' }
const MEMBERSHIP_PRICE: Record<string, number> = { MONTHLY: 4500, PACK10: 8000, PACK20: 14000, SINGLE: 900 }

// Зоны клининга — тот же набор из 7, что GymsService.create создаёт новой
// точке (P4.2): скрипт пересоздаёт их, чтобы чек-листы всегда ссылались на
// актуальные зоны демо-точки.
const CLEANING_ZONE_NAMES = ['Пол', 'Освещение', 'Поверхности', 'Зеркала', 'Санузлы', 'Шкафчики', 'Окна']

// Объекты ППР/ремонта: часть с просроченным nextServiceDate (отрицательный
// nextOff), чтобы панель ремонта показывала просрочку.
const EQUIPMENT_DEFS: Array<{ name: string; category: 'LIGHTING' | 'RESTROOMS' | 'LOCKERS' | 'AC' | 'FRIDGES' | 'GYM_EQUIPMENT'; zone: string; interval: number; lastOff: number; nextOff: number; responsible: string; warrantyOff?: number }> = [
  { name: 'Светильники потолочные (основной зал)', category: 'LIGHTING', zone: 'Тренажёрный зал', interval: 180, lastOff: -160, nextOff: 20, responsible: 'Ирина Воронцова' },
  { name: 'Светильники раздевалок', category: 'LIGHTING', zone: 'Раздевалки', interval: 180, lastOff: -185, nextOff: -5, responsible: 'Ирина Воронцова' },
  { name: 'Кондиционер канальный №1', category: 'AC', zone: 'Тренажёрный зал', interval: 90, lastOff: -102, nextOff: -12, responsible: 'ООО «Климат-Сервис»' },
  { name: 'Кондиционер канальный №2', category: 'AC', zone: 'Кардио-зона', interval: 90, lastOff: -49, nextOff: 41, responsible: 'ООО «Климат-Сервис»' },
  { name: 'Приточно-вытяжная вентиляция', category: 'AC', zone: 'Весь зал', interval: 90, lastOff: -83, nextOff: 7, responsible: 'ООО «Климат-Сервис»' },
  { name: 'Холодильник витрины (ресепшн)', category: 'FRIDGES', zone: 'Ресепшн', interval: 120, lastOff: -87, nextOff: 33, responsible: 'Павел Сазонов', warrantyOff: 400 },
  { name: 'Кулер воды', category: 'FRIDGES', zone: 'Ресепшн', interval: 90, lastOff: -93, nextOff: -3, responsible: 'Павел Сазонов' },
  { name: 'Беговая дорожка №1', category: 'GYM_EQUIPMENT', zone: 'Кардио-зона', interval: 60, lastOff: -50, nextOff: 10, responsible: 'ООО «СпортСервис»' },
  { name: 'Скамья Скотта', category: 'GYM_EQUIPMENT', zone: 'Тренажёрный зал', interval: 120, lastOff: -65, nextOff: 55, responsible: 'ООО «СпортСервис»' },
  { name: 'Рама Хаммера', category: 'GYM_EQUIPMENT', zone: 'Тяжёлая зона', interval: 90, lastOff: -40, nextOff: 50, responsible: 'ООО «СпортСервис»', warrantyOff: 700 },
  { name: 'Двери шкафчиков (банк A)', category: 'LOCKERS', zone: 'Раздевалки', interval: 180, lastOff: -90, nextOff: 90, responsible: 'Павел Сазонов' },
  { name: 'Смесители санузлов', category: 'RESTROOMS', zone: 'Санузлы', interval: 90, lastOff: -75, nextOff: 15, responsible: 'Дина Абрамова' },
]

const EFFORTS = ['WARMUP', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'] as const
const RESTS = [60, 90, 120, 180]

type Purchase = {
  date: Date
  amount: number
  category: 'MEMBERSHIP' | 'PERSONAL' | 'GROUP' | 'ANCILLARY'
  clientId: string
  trainerId?: string
  description: string
  lineType: 'MEMBERSHIP_PURCHASE' | 'PERSONAL_SLOT_BOOKING' | 'GROUP_CLASS_BOOKING' | 'STOCK_PURCHASE'
  refId?: string
  meta?: Record<string, unknown>
}

function receiptRawFor(amount: number, seq: number, date: Date) {
  const fn = '9999076543210001'
  const i = String(1370 + seq)
  const fp = String(100000 + ((seq * 7919 + 1043) % 900000))
  const t = date.toISOString().replace(/[-:]/g, '').slice(0, 13)
  return {
    receiptRaw: `t=${t}&s=${amount}&fn=${fn}&i=${i}&fp=${fp}&n=1`,
    receiptFn: fn,
    receiptI: i,
    receiptFp: fp,
  }
}

async function main() {
  const gym = await prisma.gym.findFirst({ where: gymWhere })
  if (!gym) throw new Error('Точка не найдена — задайте DEMO_GYM_ID/DEMO_GYM_NAME или сначала запустите prisma:seed')

  // --- Демо-администраторы (STAFF): upsert по email, чтобы повторные прогоны
  // не плодили учётки и не перехэшировали пароль.
  const staffHash = await bcrypt.hash(STAFF_PASSWORD, 12)
  const staffUsers: User[] = []
  for (const s of STAFF_DEFS) {
    staffUsers.push(await prisma.user.upsert({
      where: { email: s.email },
      create: { gymId: gym.id, email: s.email, name: s.name, passwordHash: staffHash, role: 'STAFF' },
      update: { name: s.name, isActive: true },
    }))
  }
  const cashier = staffUsers[0]

  await prisma.groupClassBooking.deleteMany({ where: { groupClass: { gymId: gym.id } } })
  await prisma.groupClass.deleteMany({ where: { gymId: gym.id } })
  await prisma.personalSlot.deleteMany({ where: { gymId: gym.id } })
  await prisma.workoutSetLog.deleteMany({ where: { exerciseLog: { log: { client: { gymId: gym.id } } } } })
  await prisma.workoutExerciseLog.deleteMany({ where: { log: { client: { gymId: gym.id } } } })
  await prisma.workoutLogEntry.deleteMany({ where: { client: { gymId: gym.id } } })
  await prisma.refundLine.deleteMany({ where: { refund: { gymId: gym.id } } })
  await prisma.refund.deleteMany({ where: { gymId: gym.id } })
  await prisma.transaction.deleteMany({ where: { gymId: gym.id } })
  await prisma.orderLine.deleteMany({ where: { order: { gymId: gym.id } } })
  await prisma.order.deleteMany({ where: { gymId: gym.id } })
  await prisma.membership.deleteMany({ where: { client: { gymId: gym.id } } })
  await prisma.clientFormatHistoryEntry.deleteMany({ where: { client: { gymId: gym.id } } })
  await prisma.outreachNote.deleteMany({ where: { gymId: gym.id } })
  await prisma.directorMessage.deleteMany({ where: { gymId: gym.id } })
  await prisma.feedbackMessage.deleteMany({ where: { client: { gymId: gym.id } } })
  await prisma.progressPhoto.deleteMany({ where: { client: { gymId: gym.id } } })
  await prisma.measurement.deleteMany({ where: { client: { gymId: gym.id } } })
  await prisma.cycleLog.deleteMany({ where: { client: { gymId: gym.id } } })
  await prisma.locker.deleteMany({ where: { gymId: gym.id } })
  await prisma.consentRecord.deleteMany({ where: { gymId: gym.id } })
  await prisma.stockWriteoff.deleteMany({ where: { gymId: gym.id } })
  await prisma.stockReceipt.deleteMany({ where: { gymId: gym.id } })
  await prisma.inventoryCountEntry.deleteMany({ where: { inventoryCount: { gymId: gym.id } } })
  await prisma.inventoryCount.deleteMany({ where: { gymId: gym.id } })
  await prisma.stockBatch.deleteMany({ where: { gymId: gym.id } })
  await prisma.catalogItem.deleteMany({ where: { gymId: gym.id } })
  await prisma.equipment.deleteMany({ where: { gymId: gym.id } })
  await prisma.cleaningChecklistItem.deleteMany({ where: { checklist: { gymId: gym.id } } })
  await prisma.cleaningChecklist.deleteMany({ where: { gymId: gym.id } })
  await prisma.cleaningZone.deleteMany({ where: { gymId: gym.id } })
  await prisma.checkinEntry.deleteMany({ where: { gymId: gym.id } })
  await prisma.lead.deleteMany({ where: { gymId: gym.id } })
  // Карточки демо-учёток (клиент/тренер с привязанным User) не трогаем —
  // иначе ломаются логины из seed.ts; тестовым карточкам ниже только
  // докидываем недостающие данные.
  await prisma.client.deleteMany({ where: { gymId: gym.id, userId: null } })
  await prisma.trainer.deleteMany({ where: { gymId: gym.id, userId: null } })

  const trainers: Trainer[] = []
  for (const t of TRAINER_DEFS) {
    trainers.push(await prisma.trainer.create({
      data: {
        gymId: gym.id, name: t.name, specialization: t.spec, avatarHue: t.hue,
        experienceYears: t.exp, personalSessionPrice: t.price,
        employmentType: t.emp, revenueSharePercent: t.share,
        workHours: { create: t.hours.map((h) => ({ day: h[0], startHour: h[1], endHour: h[2] })) },
      },
    }))
  }
  const testTrainer = await prisma.trainer.findFirst({ where: { gymId: gym.id, userId: { not: null } } })
  if (testTrainer && (await prisma.trainerWorkHour.count({ where: { trainerId: testTrainer.id } })) === 0) {
    await prisma.trainerWorkHour.createMany({
      data: [[1, 10, 19], [3, 10, 19], [5, 10, 18]].map((h) => ({ trainerId: testTrainer.id, day: h[0], startHour: h[1], endHour: h[2] })),
    })
  }

  const names: string[] = []
  for (let i = 0; i < MALE_NAMES.length; i++) { names.push(MALE_NAMES[i], FEMALE_NAMES[i]) }
  const clients: Array<Client & { membership: Membership | null }> = []
  for (let i = 0; i < 44; i++) {
    const format = i < 14 ? 'PERSONAL' : i < 28 ? 'GROUP' : 'SELF'
    const trainerIdx = format === 'SELF' ? -1 : i % 7
    const splitPlans = format === 'PERSONAL'
      ? [['Пн — Спина и бицепс', 'Ср — Грудь и трицепс', 'Пт — Ноги'], ['Вт — Ноги и пресс', 'Чт — Спина', 'Сб — Плечи']]
      : format === 'GROUP'
        ? [['Групповая программа — всё тело']]
        : [['Пн — Всё тело', 'Чт — Кардио и пресс'], ['Вт — Верх тела', 'Пт — Ноги']]
    const withMembership = i % 11 !== 0
    const membershipType = format === 'PERSONAL' ? (i % 3 === 0 ? 'PACK20' : 'PACK10') : format === 'GROUP' ? 'MONTHLY' : i % 4 === 0 ? 'SINGLE' : 'MONTHLY'
    const expired = withMembership && i % 9 === 0
    const frozen = withMembership && !expired && i % 17 === 0
    clients.push(await prisma.client.create({
      data: {
        gymId: gym.id,
        name: names[i],
        gender: i % 2 === 0 ? 'M' : 'F',
        avatarHue: (i * 47) % 360,
        trainerId: trainerIdx >= 0 ? trainers[trainerIdx].id : undefined,
        format,
        tariff: format === 'PERSONAL' ? (i % 3 === 0 ? 'INDIVIDUAL' : 'COACHING') : format === 'GROUP' ? 'BASIC' : i % 2 === 0 ? 'BASIC' : undefined,
        joinedAt: withMembership ? dayAt(-(30 + ri(0, 300))) : dayAt(-ri(1, 5)),
        birthday: new Date(1975 + (i % 30), (i * 3) % 12, 1 + ((i * 7) % 28)),
        phone: `+7 913 ${100 + i}-${10 + (i % 90)}-${10 + ((i * 7) % 90)}`,
        email: i % 4 === 0 ? `client${i + 1}@example.com` : undefined,
        splitPlan: splitPlans[i % splitPlans.length],
        membership: withMembership ? {
          create: {
            type: membershipType,
            scope: 'SINGLE_GYM',
            purchasedAt: dayAt(-ri(1, 30)),
            expiresAt: expired ? dayAt(-ri(1, 7)) : dayAt(ri(3, 25)),
            visitsTotal: membershipType === 'PACK10' ? 10 : membershipType === 'PACK20' ? 20 : undefined,
            visitsLeft: membershipType === 'PACK10' ? ri(2, 9) : membershipType === 'PACK20' ? ri(4, 18) : undefined,
            status: expired ? 'EXPIRED' : frozen ? 'FROZEN' : 'ACTIVE',
            frozenDaysUsed: frozen ? ri(3, 9) : undefined,
            freezeEndsAt: frozen ? dayAt(ri(1, 5)) : undefined,
          },
        } : undefined,
      },
      include: { membership: true },
    }))
  }
  // Демо-клиент из seed.ts: если карточка без абонемента — выдаём месячный,
  // чтобы у тестового логина были и профиль, и покупки.
  let testClient = await prisma.client.findFirst({ where: { gymId: gym.id, userId: { not: null } }, include: { membership: true } })
  if (testClient && !testClient.membership) {
    testClient = await prisma.client.update({
      where: { id: testClient.id },
      data: { membership: { create: { type: 'MONTHLY', scope: 'SINGLE_GYM', purchasedAt: dayAt(-12), expiresAt: dayAt(18), status: 'ACTIVE' } } },
      include: { membership: true },
    })
  }
  if (testClient) clients.push(testClient)

  // --- Покупки: каждая превращается в PAID-заказ с чеком (P0.2) и связанную
  // транзакцию — деньги в демо «приняты через кассу», как в реальном flow.
  const purchases: Purchase[] = []
  for (const c of clients) {
    if (c.membership) {
      purchases.push({
        date: c.membership.purchasedAt, amount: MEMBERSHIP_PRICE[c.membership.type], category: 'MEMBERSHIP',
        clientId: c.id, description: `Покупка абонемента (${MEMBERSHIP_LABEL[c.membership.type]})`,
        lineType: 'MEMBERSHIP_PURCHASE', meta: { membershipType: c.membership.type, scope: 'SINGLE_GYM' },
      })
    }
    if (c.format === 'PERSONAL' && c.trainerId) {
      const single = clients.indexOf(c) % 3 === 0
      purchases.push({
        date: dayAt(-ri(2, 30)), amount: single ? 2200 : 9000, category: 'PERSONAL',
        clientId: c.id, trainerId: c.trainerId,
        description: single ? 'Персональная тренировка (разовая)' : 'Пакет 5 персональных тренировок',
        lineType: 'PERSONAL_SLOT_BOOKING', refId: c.trainerId, meta: { trainerId: c.trainerId, sessions: single ? 1 : 5 },
      })
    }
    if (c.format === 'GROUP' && c.trainerId) {
      purchases.push({
        date: dayAt(-ri(2, 30)), amount: 3500, category: 'GROUP', clientId: c.id,
        description: 'Групповые занятия, месяц', lineType: 'GROUP_CLASS_BOOKING',
      })
    }
  }

  const catalog: CatalogItem[] = []
  for (const [name, category, price, emoji, shelfQty, whQty] of CATALOG) {
    const item = await prisma.catalogItem.create({ data: { gymId: gym.id, name, category, price, emoji } })
    catalog.push(item)
    await prisma.stockBatch.createMany({
      data: [
        { gymId: gym.id, catalogItemId: item.id, location: 'SHELF', quantity: shelfQty, receivedAt: dayAt(-25), expiresAt: dayAt(ri(150, 500)) },
        { gymId: gym.id, catalogItemId: item.id, location: 'WAREHOUSE', quantity: whQty, receivedAt: dayAt(-25), expiresAt: dayAt(ri(150, 540)) },
      ],
    })
  }
  for (let i = 0; i < 24; i++) {
    const item = pick(catalog)
    purchases.push({
      date: dayAt(-ri(0, 29)), amount: item.price, category: 'ANCILLARY', clientId: pick(clients).id,
      description: `Покупка: ${item.name}`, lineType: 'STOCK_PURCHASE', refId: item.id, meta: { itemId: item.id },
    })
  }

  let receiptSeq = 0
  for (const p of purchases) {
    receiptSeq++
    const receipt = receiptRawFor(p.amount, receiptSeq, p.date)
    const order = await prisma.order.create({
      data: {
        gymId: gym.id, clientId: p.clientId, createdBy: cashier.id,
        status: 'PAID', paymentMethod: 'CASH', totalAmount: p.amount,
        ...receipt, receiptDate: p.date, paidAt: p.date, createdAt: p.date,
        lines: { create: { type: p.lineType, refId: p.refId ?? null, amount: p.amount, meta: (p.meta ?? {}) as object } },
      },
    })
    await prisma.transaction.create({
      data: { gymId: gym.id, date: p.date, amount: p.amount, category: p.category, clientId: p.clientId, trainerId: p.trainerId, description: p.description, orderId: order.id },
    })
  }
  await prisma.transaction.create({
    data: { gymId: gym.id, date: dayAt(-9), amount: -4500, category: 'REFUND', clientId: clients[3].id, description: 'Возврат абонемента по заявке клиента' },
  })

  // --- Документы склада: приход (включая пополнение витрины) и списания.
  for (const item of catalog) {
    const [, , , , shelfQty, whQty] = CATALOG[catalog.indexOf(item)]
    await prisma.stockReceipt.create({ data: { gymId: gym.id, catalogItemId: item.id, location: 'WAREHOUSE', quantity: shelfQty + whQty + 6, date: dayAt(-25), authorId: cashier.id } })
    await prisma.stockReceipt.create({ data: { gymId: gym.id, catalogItemId: item.id, location: 'SHELF', quantity: shelfQty, date: dayAt(-10), authorId: cashier.id } })
  }
  const writeoffDefs: Array<[number, 'EXPIRED' | 'DAMAGED' | 'USED_INTERNALLY' | 'LOST', string | null]> = [
    [0, 'EXPIRED', 'Партия с истёкшим сроком, витрина'],
    [3, 'DAMAGED', 'Повреждена упаковка при транспортировке'],
    [6, 'DAMAGED', null],
    [9, 'USED_INTERNALLY', 'Выдано тренерам после смены'],
    [10, 'LOST', 'Недостача по инвентаризации'],
    [1, 'EXPIRED', null],
  ]
  for (const [idx, reason, comment] of writeoffDefs) {
    await prisma.stockWriteoff.create({
      data: { gymId: gym.id, catalogItemId: catalog[idx].id, location: idx % 2 === 0 ? 'SHELF' : 'WAREHOUSE', quantity: ri(1, 3), reason, comment, date: dayAt(-ri(2, 20)), authorId: cashier.id },
    })
  }
  const inventoryCount = await prisma.inventoryCount.create({ data: { gymId: gym.id, date: dayAt(-3), authorId: cashier.id } })
  const inventoryEntries: Array<{ inventoryCountId: string; catalogItemId: string; location: 'SHELF' | 'WAREHOUSE'; systemQty: number; countedQty: number }> = []
  for (const [idx, item] of catalog.entries()) {
    const shelfQty = CATALOG[idx][4]
    inventoryEntries.push({ inventoryCountId: inventoryCount.id, catalogItemId: item.id, location: 'SHELF', systemQty: shelfQty, countedQty: idx % 4 === 0 ? shelfQty - 1 : shelfQty })
    if (idx < 3) inventoryEntries.push({ inventoryCountId: inventoryCount.id, catalogItemId: item.id, location: 'WAREHOUSE', systemQty: CATALOG[idx][5], countedQty: CATALOG[idx][5] })
  }
  await prisma.inventoryCountEntry.createMany({ data: inventoryEntries })

  // --- Демо-проходы через контроль доступа (P2.2): последние две недели.
  const checkinRows: Array<{ gymId: string; clientId: string; at: Date; source: 'QR' | 'MANUAL' }> = []
  const activeMembers = clients.filter((c) => c.membership?.status === 'ACTIVE')
  for (let i = 0; i < 18; i++) {
    checkinRows.push({
      gymId: gym.id,
      clientId: pick(activeMembers).id,
      at: new Date(dayAt(-ri(0, 13)).getTime() + ri(8, 21) * 3600000 + ri(0, 59) * 60000),
      source: i % 6 === 0 ? 'MANUAL' : 'QR',
    })
  }
  checkinRows.sort((a, b) => a.at.getTime() - b.at.getTime())
  await prisma.checkinEntry.createMany({ data: checkinRows })

  // Шкафчики (P2.8): 24 штуки двумя банками по 12.
  const lockerRows: Array<{
    gymId: string; number: number; status: 'FREE' | 'RENTED'; pricePerDay: number;
    bankId: string; controllerId: string; channelNumber: number; doorState: 'OPEN' | 'CLOSED';
    rentedBy?: string; rentedUntil?: Date;
  }> = []
  for (let i = 1; i <= 24; i++) {
    const bank = i <= 12 ? 'A' : 'B'
    lockerRows.push({
      gymId: gym.id, number: i, status: 'FREE', pricePerDay: 100,
      bankId: `bank-${bank}`, controllerId: `kr-${bank.toLowerCase()}-01`,
      channelNumber: ((i - 1) % 12) + 1, doorState: 'CLOSED',
    })
  }
  for (const ci of [4, 17]) {
    lockerRows[ci].status = 'RENTED'
    lockerRows[ci].rentedBy = clients[ci + 2].id
    lockerRows[ci].rentedUntil = dayAt(ri(1, 5))
  }
  await prisma.locker.createMany({ data: lockerRows })

  const bookingPool = clients.filter((c) => c.format !== 'SELF')
  let classCounter = 0
  for (let offset = -35; offset <= 7; offset++) {
    const date = dayAt(offset)
    const wd = date.getDay()
    for (const tpl of CLASS_TEMPLATES) {
      if (!tpl.days.includes(wd)) continue
      const gc = await prisma.groupClass.create({
        data: { gymId: gym.id, type: tpl.type, trainerId: trainers[tpl.trainer].id, zone: tpl.zone, date, start: tpl.start, end: tpl.end, capacity: 12 },
      })
      const count = offset < 0 ? ri(4, 11) : ri(3, 8)
      const start = (classCounter * 5) % bookingPool.length
      const picked: Client[] = []
      for (let k = 0; k < count; k++) {
        const c = bookingPool[(start + k * 3) % bookingPool.length]
        if (!picked.includes(c)) picked.push(c)
      }
      if (picked.length) {
        await prisma.groupClassBooking.createMany({ data: picked.map((c) => ({ groupClassId: gc.id, clientId: c.id })) })
      }
      classCounter++
    }
  }

  for (let ti = 0; ti < trainers.length; ti++) {
    const trainer = trainers[ti]
    const pool = clients.filter((c) => c.trainerId === trainer.id)
    const hours = SLOT_HOUR_POOLS[ti]
    let slotCounter = 0
    for (let offset = -35; offset <= 7; offset++) {
      if (offset === 0) continue
      if ((offset + ti) % 2 !== 0) continue
      const rows: Array<{ gymId: string; trainerId: string; date: Date; start: string; end: string; clientId?: string; status: 'FREE' | 'BOOKED' | 'PAST_COMPLETED' | 'PAST_MISSED' }> = []
      const mk = (hour: number, clientIdx: number, booked: boolean) => {
        const client = pool.length ? pool[(slotCounter + clientIdx) % pool.length] : undefined
        rows.push({
          gymId: gym.id, trainerId: trainer.id, date: dayAt(offset),
          start: `${String(hour).padStart(2, '0')}:00`, end: `${String(hour + 1).padStart(2, '0')}:00`,
          clientId: booked && client ? client.id : undefined,
          status: offset < 0 ? (booked ? (rnd() < 0.9 ? 'PAST_COMPLETED' : 'PAST_MISSED') : 'FREE') : booked ? 'BOOKED' : 'FREE',
        })
      }
      mk(hours[0], 0, true)
      mk(hours[1], 1, true)
      if (offset > 0) mk(hours[2], 2, false)
      slotCounter++
      await prisma.personalSlot.createMany({ data: rows })
    }
  }

  const logs: Array<{ clientId: string; date: Date; dayLabel: string; status: 'COMPLETED' | 'PARTIAL' | 'MISSED' }> = []
  clients.forEach((c, ci) => {
    const freq = c.format === 'SELF' ? 5 : 3
    let visitIdx = 0
    for (let offset = -29; offset <= 0; offset++) {
      if ((offset * 31 + ci * 7) % freq !== 0) continue
      const r = rnd()
      logs.push({
        clientId: c.id,
        date: dayAt(offset),
        dayLabel: c.splitPlan.length ? c.splitPlan[visitIdx % c.splitPlan.length] : 'Тренировка',
        status: r < 0.85 ? 'COMPLETED' : r < 0.95 ? 'PARTIAL' : 'MISSED',
      })
      visitIdx++
    }
  })
  await prisma.workoutLogEntry.createMany({ data: logs })

  // --- Наполнение тренировок упражнениями и подходами из библиотеки точки.
  const exercises = await prisma.exercise.findMany({ where: { gymId: gym.id } })
  if (exercises.length) {
    const logStatus = new Map(logs.map((l) => [`${l.clientId}|${l.date.getTime()}`, l.status]))
    const createdLogs = await prisma.workoutLogEntry.findMany({ where: { client: { gymId: gym.id } }, orderBy: [{ clientId: 'asc' }, { date: 'asc' }] })
    const exLogRows: Array<{ logId: string; exerciseId: string }> = []
    createdLogs.forEach((log, li) => {
      const status = logStatus.get(`${log.clientId}|${new Date(log.date).getTime()}`) ?? 'COMPLETED'
      if (status === 'MISSED') return
      const exCount = status === 'PARTIAL' ? 2 : 3
      for (let k = 0; k < exCount; k++) {
        const ex = exercises[(li * 3 + k * 29 + 11) % exercises.length]
        exLogRows.push({ logId: log.id, exerciseId: ex.id })
      }
    })
    await prisma.workoutExerciseLog.createMany({ data: exLogRows })
    const partialLogIds = new Set(
      createdLogs
        .filter((log) => (logStatus.get(`${log.clientId}|${new Date(log.date).getTime()}`) ?? 'COMPLETED') === 'PARTIAL')
        .map((log) => log.id),
    )
    const exById = new Map(exercises.map((e) => [e.id, e]))
    const setRows: Array<{ exerciseLogId: string; reps: string; load: string; completed: boolean; effort: 'WARMUP' | 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD'; restSeconds: number }> = []
    const createdExLogs = await prisma.workoutExerciseLog.findMany({ where: { log: { client: { gymId: gym.id } } } })
    createdExLogs.forEach((exLog, ei) => {
      const ex = exById.get(exLog.exerciseId)
      const isPartial = partialLogIds.has(exLog.logId)
      for (let s = 0; s < 3; s++) {
        setRows.push({
          exerciseLogId: exLog.id,
          reps: ex?.defaultReps ?? '10-12',
          load: ex?.defaultLoad ?? '40 кг',
          completed: !(isPartial && s === 2),
          effort: EFFORTS[(ei + s) % EFFORTS.length],
          restSeconds: RESTS[(ei + s) % RESTS.length],
        })
      }
    })
    await prisma.workoutSetLog.createMany({ data: setRows })
  }

  // Гостевые карточки (лиды) — P2.6.
  const leadDefs: Array<{ name: string; phone: string; offset: number; status: 'NEW' | 'VISITED' | 'CONVERTED' | 'LOST'; note?: string }> = [
    { name: 'Артём Гуров', phone: '+7 913 000-11-22', offset: 2, status: 'NEW', note: 'Пришёл из Instagram, интересуется силовыми' },
    { name: 'Кристина Лебедева', phone: '+7 913 000-33-44', offset: 1, status: 'NEW' },
    { name: 'Павел Сомов', phone: '+7 913 000-55-66', offset: -1, status: 'VISITED', note: 'Пробная тренировка с тренером, решает до конца недели' },
    { name: 'Алина Ким', phone: '+7 913 000-77-88', offset: -3, status: 'VISITED' },
    { name: 'Сергей Волков', phone: '+7 913 000-99-00', offset: -9, status: 'LOST', note: 'Ушёл к конкуренту из-за цены' },
    { name: 'Дарья Нечаева', phone: '+7 913 000-12-34', offset: -14, status: 'LOST' },
    { name: 'Егор Титов', phone: '+7 913 000-56-78', offset: -6, status: 'CONVERTED' },
    { name: 'Марина Денисова', phone: '+7 913 000-90-12', offset: -20, status: 'CONVERTED' },
  ]
  for (const l of leadDefs) {
    await prisma.lead.create({
      data: {
        gymId: gym.id, name: l.name, phone: l.phone, visitDate: dayAt(l.offset), status: l.status, note: l.note ?? null,
        ...(l.status === 'CONVERTED' ? { convertedClientId: clients[(l.offset + 30) % clients.length].id, convertedAt: dayAt(l.offset + 1) } : {}),
      },
    })
  }

  // --- Клининг: зоны + чек-листы за последнюю неделю (сегодняшний частично
  // не выполнен — видно «живую» смену).
  const zoneIds: string[] = []
  for (const [idx, zoneName] of CLEANING_ZONE_NAMES.entries()) {
    const zone = await prisma.cleaningZone.create({ data: { gymId: gym.id, name: zoneName, position: idx } })
    zoneIds.push(zone.id)
  }
  let checklistsCreated = 0
  for (let offset = -6; offset <= 0; offset++) {
    const responsible = STAFF_DEFS[(offset + 6) % STAFF_DEFS.length].name
    const checklist = await prisma.cleaningChecklist.create({ data: { gymId: gym.id, date: dayAt(offset), responsibleName: responsible } })
    const undoneCount = offset <= -2 ? 0 : offset === -1 ? 1 : 3
    await prisma.cleaningChecklistItem.createMany({
      data: zoneIds.map((zoneId, idx) => ({ checklistId: checklist.id, zoneId, done: idx < zoneIds.length - undoneCount })),
    })
    checklistsCreated++
  }

  // --- Объекты ремонта (ППР).
  for (const eq of EQUIPMENT_DEFS) {
    await prisma.equipment.create({
      data: {
        gymId: gym.id, name: eq.name, category: eq.category, zone: eq.zone,
        responsibleName: eq.responsible,
        lastServiceDate: dayAt(eq.lastOff), nextServiceDate: dayAt(eq.nextOff),
        intervalDays: eq.interval, warrantyUntil: eq.warrantyOff != null ? dayAt(eq.warrantyOff) : null,
      },
    })
  }

  console.log(JSON.stringify({
    gym: `${gym.name} (${gym.id})`,
    staffUsers: staffUsers.length,
    trainers: await prisma.trainer.count({ where: { gymId: gym.id } }),
    clients: await prisma.client.count({ where: { gymId: gym.id } }),
    memberships: await prisma.membership.count({ where: { client: { gymId: gym.id } } }),
    orders: await prisma.order.count({ where: { gymId: gym.id } }),
    transactions: await prisma.transaction.count({ where: { gymId: gym.id } }),
    catalogItems: catalog.length,
    stockBatches: await prisma.stockBatch.count({ where: { gymId: gym.id } }),
    stockReceipts: await prisma.stockReceipt.count({ where: { gymId: gym.id } }),
    stockWriteoffs: await prisma.stockWriteoff.count({ where: { gymId: gym.id } }),
    inventoryCounts: await prisma.inventoryCount.count({ where: { gymId: gym.id } }),
    groupClasses: classCounter,
    personalSlots: await prisma.personalSlot.count({ where: { gymId: gym.id } }),
    workoutLogs: logs.length,
    workoutExerciseLogs: await prisma.workoutExerciseLog.count({ where: { log: { client: { gymId: gym.id } } } }),
    workoutSetLogs: await prisma.workoutSetLog.count({ where: { exerciseLog: { log: { client: { gymId: gym.id } } } } }),
    checkins: checkinRows.length,
    lockers: lockerRows.length,
    leads: leadDefs.length,
    cleaningZones: zoneIds.length,
    cleaningChecklists: checklistsCreated,
    equipment: EQUIPMENT_DEFS.length,
  }, null, 1))
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
