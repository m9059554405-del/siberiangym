import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGroupClasses, usePersonalSlots, useTrainers } from '../../hooks/useClientApi'
import { useAllWorkoutLogs } from '../../hooks/useCeoApi'
import { NetworkGymFilter, defaultGymScope, inGymScope, trainerInGymScope } from './NetworkGymFilter'
import { getAttendanceByDay, getTrainerHourlyOccupancy, getVisitTimeDistribution } from '../../lib/ceoSelectors'
import { Card, SectionTitle, StatTile, Tabs } from '../../components/ui/Primitives'

export function AttendancePage() {
  const { data: allLogs } = useAllWorkoutLogs()
  const { data: trainers } = useTrainers()
  const { data: groupClasses } = useGroupClasses()
  const { data: personalSlots } = usePersonalSlots()
  const [range, setRange] = useState<'30' | '60' | '90'>('30')
  const [gymScope, setGymScope] = useState<string[]>(defaultGymScope)

  // Фиды CEO уже отдают всю сеть (P1.7); фильтр по точкам — на клиенте.
  // Дефолт — активная точка (переключатель в шапке), можно выбрать
  // несколько площадок или всю сеть.
  const logs = useMemo(
    () => (allLogs ?? []).filter((l) => inGymScope(gymScope, l.client?.gymId)),
    [allLogs, gymScope],
  )
  const fTrainers = useMemo(() => (trainers ?? []).filter((t) => trainerInGymScope(gymScope, t)), [trainers, gymScope])
  const fClasses = useMemo(
    () => (groupClasses ?? []).filter((c) => inGymScope(gymScope, c.gymId)),
    [groupClasses, gymScope],
  )
  const fSlots = useMemo(
    () => (personalSlots ?? []).filter((s) => inGymScope(gymScope, s.gymId)),
    [personalSlots, gymScope],
  )

  const points = useMemo(() => getAttendanceByDay(logs, Number(range)), [logs, range])

  const weeklyPoints = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of points) {
      const d = new Date(p.date + 'T00:00:00')
      const wd = d.getDay() === 0 ? 6 : d.getDay() - 1
      const monday = new Date(d.getTime() - wd * 86400000)
      const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
      map.set(key, (map.get(key) ?? 0) + p.visits)
    }
    return [...map.entries()].map(([week, visits]) => ({ week, visits })).sort((a, b) => a.week.localeCompare(b.week))
  }, [points])

  const total = points.reduce((s, p) => s + p.visits, 0)
  const avgPerDay = points.length ? Math.round(total / points.length) : 0
  const peak = points.reduce((max, p) => (p.visits > max.visits ? p : max), points[0] ?? { date: '', visits: 0 })

  const hourPoints = useMemo(() => getVisitTimeDistribution(fClasses, fSlots), [fClasses, fSlots])
  const occupancy = useMemo(() => getTrainerHourlyOccupancy(fTrainers, fClasses, fSlots), [fTrainers, fClasses, fSlots])
  const maxOccupancy = Math.max(1, ...occupancy.rows.flatMap((r) => r.counts))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Посещаемость</h1>
          <p className="text-sm text-[var(--text-muted)]">Сколько людей ходит в клуб по дням и неделям</p>
        </div>
        <NetworkGymFilter value={gymScope} onChange={setGymScope} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatTile label={`Визитов за ${range} дн.`} value={total} />
        <StatTile label="В среднем/день" value={avgPerDay} />
        <StatTile label="Пиковый день" value={peak.visits} hint={peak.date} />
      </div>

      <Card>
        <SectionTitle
          title="Динамика по дням"
          action={<Tabs value={range} onChange={setRange} options={[{ value: '30', label: '30 дней' }, { value: '60', label: '60 дней' }, { value: '90', label: '90 дней' }]} />}
        />
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ left: -20, right: 10 }}>
              <defs>
                <linearGradient id="attendanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--ceo-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--ceo-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" fontSize={10} stroke="var(--text-faint)" tickFormatter={(v: string) => v.slice(5)} minTickGap={20} />
              <YAxis fontSize={11} stroke="var(--text-faint)" allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="visits" name="Визиты" stroke="var(--ceo-accent)" fill="url(#attendanceFill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle title="По неделям" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeklyPoints} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" fontSize={10} stroke="var(--text-faint)" tickFormatter={(v: string) => v.slice(5)} />
              <YAxis fontSize={11} stroke="var(--text-faint)" allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="visits" name="Визиты" stroke="var(--trainer-accent)" fill="var(--trainer-accent)" fillOpacity={0.18} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Время посещений" subtitle="В какие часы клиенты чаще всего приходят в клуб" />
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourPoints} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="hour" fontSize={10} stroke="var(--text-faint)" tickFormatter={(v: number) => `${v}:00`} />
              <YAxis fontSize={11} stroke="var(--text-faint)" allowDecimals={false} />
              <Tooltip formatter={(v: any) => [v, 'Визиты']} labelFormatter={(v: any) => `${v}:00`} />
              <Bar dataKey="visits" fill="var(--ceo-accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Занятость тренеров по времени суток" subtitle="Сумма персональных слотов и групповых занятий по часам" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th className="text-left text-xs text-[var(--text-faint)]">Тренер</th>
                {occupancy.hours.map((h) => (
                  <th key={h} className="text-center text-[10px] font-normal text-[var(--text-faint)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {occupancy.rows.map((row) => (
                <tr key={row.trainerId}>
                  <td className="pr-2 text-xs font-medium whitespace-nowrap">{row.name.split(' ')[0]}</td>
                  {row.counts.map((c, i) => (
                    <td key={i} className="p-0">
                      <div title={`${c} занятий`} className="h-6 w-full rounded" style={{ background: c === 0 ? 'var(--surface-sunken)' : 'var(--ceo-accent)', opacity: c === 0 ? 1 : 0.25 + (c / maxOccupancy) * 0.75 }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
