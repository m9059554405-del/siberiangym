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

export interface RevenuePoint {
  key: string
  total: number
  MEMBERSHIP: number
  PERSONAL: number
  GROUP: number
  ANCILLARY: number
  REFUND: number
}

interface TxLike {
  date: string
  amount: number
  category: 'MEMBERSHIP' | 'PERSONAL' | 'GROUP' | 'ANCILLARY' | 'REFUND'
}

function emptyRevenuePoint(key: string): RevenuePoint {
  return { key, total: 0, MEMBERSHIP: 0, PERSONAL: 0, GROUP: 0, ANCILLARY: 0, REFUND: 0 }
}

function bucketRevenue(transactions: TxLike[], keyFn: (t: TxLike) => string): RevenuePoint[] {
  const map = new Map<string, RevenuePoint>()
  for (const tx of transactions) {
    const key = keyFn(tx)
    if (!map.has(key)) map.set(key, emptyRevenuePoint(key))
    const row = map.get(key)!
    row.total += tx.amount
    row[tx.category] += tx.amount
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export function getRevenueByDay(transactions: TxLike[], days = 30): RevenuePoint[] {
  const today = new Date()
  const start = addDays(today, -days + 1)
  const filtered = transactions.filter((t) => new Date(t.date) >= start)
  const bucketed = bucketRevenue(filtered, (t) => t.date.slice(0, 10))
  const map = new Map(bucketed.map((r) => [r.key, r]))
  const points: RevenuePoint[] = []
  for (let i = 0; i < days; i++) {
    const key = isoDate(addDays(start, i))
    points.push(map.get(key) ?? emptyRevenuePoint(key))
  }
  return points
}

export function getRevenueByMonth(transactions: TxLike[]): RevenuePoint[] {
  return bucketRevenue(transactions, (t) => t.date.slice(0, 7))
}

export interface TrainerRevenueRow {
  trainerId: string
  name: string
  revenue: number
  clients: number
}

export function getTopTrainersByRevenue(trainers: Trainer[], clients: Client[], transactions: { trainerId?: string | null; amount: number }[]): TrainerRevenueRow[] {
  const revenueMap = new Map<string, number>()
  for (const tx of transactions) {
    if (!tx.trainerId) continue
    revenueMap.set(tx.trainerId, (revenueMap.get(tx.trainerId) ?? 0) + tx.amount)
  }
  return trainers
    .map((t) => ({ trainerId: t.id, name: t.name, revenue: revenueMap.get(t.id) ?? 0, clients: clients.filter((c) => c.trainerId === t.id).length }))
    .sort((a, b) => b.revenue - a.revenue)
}

export function getClientBaseBreakdown(clients: Client[]) {
  return {
    PERSONAL: clients.filter((c) => c.format === 'PERSONAL').length,
    GROUP: clients.filter((c) => c.format === 'GROUP').length,
    SELF: clients.filter((c) => c.format === 'SELF').length,
  }
}

export function getTotalRevenue(transactions: { amount: number }[]): number {
  return transactions.reduce((sum, t) => sum + t.amount, 0)
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
