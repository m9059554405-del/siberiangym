import type { Client, GroupClass, PersonalSlot, Trainer, WorkoutLogEntry } from '../types'

const DAY_MS = 86400000

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * DAY_MS)
}

export interface TrainerLoadRow {
  trainerId: string
  name: string
  specialization: string
  avatarHue: number
  total: number
  personal: number
  group: number
  self: number
  classesNext7Days: number
  personalSlotsBookedNext7Days: number
  weeklyWorkHours: number
}

export function getTrainerLoad(trainers: Trainer[], clients: Client[], groupClasses: GroupClass[], personalSlots: PersonalSlot[]): TrainerLoadRow[] {
  const today = new Date()
  const in7 = isoDate(addDays(today, 7))
  const todayStr = isoDate(today)

  return trainers.map((t) => {
    const own = clients.filter((c) => c.trainerId === t.id)
    const classesNext7Days = groupClasses.filter((gc) => gc.trainerId === t.id && gc.date.slice(0, 10) >= todayStr && gc.date.slice(0, 10) <= in7).length
    const personalSlotsBookedNext7Days = personalSlots.filter(
      (s) => s.trainerId === t.id && s.status === 'BOOKED' && s.date.slice(0, 10) >= todayStr && s.date.slice(0, 10) <= in7,
    ).length
    const weeklyWorkHours = t.workHours.reduce((sum, block) => sum + (block.endHour - block.startHour), 0)

    return {
      trainerId: t.id,
      name: t.name,
      specialization: t.specialization,
      avatarHue: t.avatarHue,
      total: own.length,
      personal: own.filter((c) => c.format === 'PERSONAL').length,
      group: own.filter((c) => c.format === 'GROUP').length,
      self: own.filter((c) => c.format === 'SELF').length,
      classesNext7Days,
      personalSlotsBookedNext7Days,
      weeklyWorkHours,
    }
  })
}

export interface AttendancePoint {
  date: string
  visits: number
}

export function getAttendanceByDay(logs: WorkoutLogEntry[], days = 30): AttendancePoint[] {
  const today = new Date()
  const start = addDays(today, -days + 1)
  const counts = new Map<string, number>()
  for (const log of logs) {
    if (log.status === 'MISSED') continue
    const d = log.date.slice(0, 10)
    if (new Date(d) < start) continue
    counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  const points: AttendancePoint[] = []
  for (let i = 0; i < days; i++) {
    const d = isoDate(addDays(start, i))
    points.push({ date: d, visits: counts.get(d) ?? 0 })
  }
  return points
}

// P3.19: клиентская агрегация выручки удалена — цифры считает сервер
// (/transactions/summary), реестр пагинирован (/transactions). Здесь
// остались только селекторы, не связанные с деньгами.

export function getClientBaseBreakdown(clients: Client[]) {
  return {
    PERSONAL: clients.filter((c) => c.format === 'PERSONAL').length,
    GROUP: clients.filter((c) => c.format === 'GROUP').length,
    SELF: clients.filter((c) => c.format === 'SELF').length,
  }
}

export interface HourPoint {
  hour: number
  visits: number
}

export function getVisitTimeDistribution(groupClasses: GroupClass[], personalSlots: PersonalSlot[]): HourPoint[] {
  const todayStr = isoDate(new Date())
  const counts = new Array(24).fill(0)
  for (const s of personalSlots) {
    if (s.status !== 'PAST_COMPLETED') continue
    counts[Number(s.start.split(':')[0])]++
  }
  for (const gc of groupClasses) {
    if (gc.date.slice(0, 10) > todayStr) continue
    counts[Number(gc.start.split(':')[0])] += gc.bookings.length
  }
  return counts.map((visits, hour) => ({ hour, visits })).filter((p) => p.hour >= 6 && p.hour <= 22)
}

export interface TrainerHourlyOccupancy {
  hours: number[]
  rows: { trainerId: string; name: string; counts: number[] }[]
}

export function getTrainerHourlyOccupancy(trainers: Trainer[], groupClasses: GroupClass[], personalSlots: PersonalSlot[]): TrainerHourlyOccupancy {
  const hours = Array.from({ length: 16 }, (_, i) => i + 6)
  const rows = trainers.map((t) => {
    const counts = hours.map(() => 0)
    for (const s of personalSlots) {
      if (s.trainerId !== t.id || !s.clientId) continue
      const idx = hours.indexOf(Number(s.start.split(':')[0]))
      if (idx >= 0) counts[idx]++
    }
    for (const gc of groupClasses) {
      if (gc.trainerId !== t.id) continue
      const idx = hours.indexOf(Number(gc.start.split(':')[0]))
      if (idx >= 0) counts[idx]++
    }
    return { trainerId: t.id, name: t.name, counts }
  })
  return { hours, rows }
}
