import { PrismaClient, Trainer, Client, CatalogItem, Membership } from '@prisma/client'

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

async function main() {
  const gym = await prisma.gym.findFirst({ where: { name: 'SiberianGym' } })
  if (!gym) throw new Error('Зал SiberianGym не найден — сначала запустите prisma:seed')

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
  await prisma.client.deleteMany({ where: { gymId: gym.id } })
  await prisma.trainer.deleteMany({ where: { gymId: gym.id } })

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

  const txRows: Array<{ gymId: string; date: Date; amount: number; category: 'MEMBERSHIP' | 'PERSONAL' | 'GROUP' | 'ANCILLARY' | 'REFUND'; clientId: string; trainerId?: string; description: string }> = []
  for (const c of clients) {
    if (c.membership) {
      txRows.push({
        gymId: gym.id, date: c.membership.purchasedAt, amount: MEMBERSHIP_PRICE[c.membership.type],
        category: 'MEMBERSHIP', clientId: c.id,
        description: `Покупка абонемента (${MEMBERSHIP_LABEL[c.membership.type]})`,
      })
    }
    if (c.format === 'PERSONAL' && c.trainerId) {
      txRows.push({
        gymId: gym.id, date: dayAt(-ri(2, 30)), amount: clients.indexOf(c) % 3 === 0 ? 2200 : 9000,
        category: 'PERSONAL', clientId: c.id, trainerId: c.trainerId,
        description: clients.indexOf(c) % 3 === 0 ? 'Персональная тренировка (разовая)' : 'Пакет 5 персональных тренировок',
      })
    }
    if (c.format === 'GROUP' && c.trainerId) {
      txRows.push({
        gymId: gym.id, date: dayAt(-ri(2, 30)), amount: 3500, category: 'GROUP', clientId: c.id,
        description: 'Групповые занятия, месяц',
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
    txRows.push({ gymId: gym.id, date: dayAt(-ri(0, 29)), amount: item.price, category: 'ANCILLARY', clientId: pick(clients).id, description: `Покупка: ${item.name}` })
  }
  txRows.push({ gymId: gym.id, date: dayAt(-9), amount: -4500, category: 'REFUND', clientId: clients[3].id, description: 'Возврат абонемента по заявке клиента' })
  await prisma.transaction.createMany({ data: txRows })

  // Демо-проходы через контроль доступа (P2.2): последние две недели,
  // только клиенты с действующим абонементом (отказы прохода в журнале
  // не живут — там одни успешные сканы).
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

  console.log(JSON.stringify({
    gym: gym.name,
    trainers: await prisma.trainer.count({ where: { gymId: gym.id } }),
    clients: await prisma.client.count({ where: { gymId: gym.id } }),
    memberships: await prisma.membership.count({ where: { client: { gymId: gym.id } } }),
    catalogItems: catalog.length,
    stockBatches: await prisma.stockBatch.count({ where: { gymId: gym.id } }),
    transactions: txRows.length,
    groupClasses: classCounter,
    personalSlots: await prisma.personalSlot.count({ where: { gymId: gym.id } }),
    workoutLogs: logs.length,
  }, null, 1))
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
