import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Download } from 'lucide-react'
import { useTransactions } from '../../hooks/useCeoApi'
import { useAuthStore } from '../../store/useAuthStore'
import { NetworkGymFilter, defaultGymScope, inGymScope } from './NetworkGymFilter'
import { getRevenueByDay, getRevenueByGym, getRevenueByMonth, getTopTrainersByRevenue, getTotalRevenue } from '../../lib/ceoSelectors'
import { Avatar } from '../../components/ui/Avatar'
import { Button, Card, SectionTitle, StatTile, Tabs } from '../../components/ui/Primitives'
import { getInitials } from '../../lib/format'
import type { TransactionCategory } from '../../types'

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  MEMBERSHIP: 'Абонементы', PERSONAL: 'Персональные', GROUP: 'Групповые', ANCILLARY: 'Сопутствующие', REFUND: 'Возвраты',
}
const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  MEMBERSHIP: 'var(--ceo-accent)', PERSONAL: '#3b82f6', GROUP: '#7dd3fc', ANCILLARY: '#bfdbfe', REFUND: '#ef4444',
}

function fmt(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

export function RevenuePage() {
  const { data: transactions } = useTransactions()
  const [granularity, setGranularity] = useState<'day' | 'month'>('day')
  const [gymScope, setGymScope] = useState<string[]>(defaultGymScope)
  // P4.3: выгрузка для бухгалтерии — CSV по всей сети за выбранный период
  // (дефолт — текущий месяц). Скачивание идёт с Bearer-токеном через fetch,
  // поэтому обычный <a href> не подходит.
  const [from, setFrom] = useState(() => new Date().toISOString().slice(0, 8) + '01')
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [downloading, setDownloading] = useState(false)
  const token = useAuthStore((s) => s.token)

  async function downloadCsv() {
    setDownloading(true)
    try {
      const res = await fetch(`/api/transactions/export?from=${from}&to=${to}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `siberiangym-transactions-${from}_${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  // Фид уже отдаёт всю сеть (P1.7) — фильтр по точкам считается на клиенте,
  // без перезагрузки данных. Дефолт — активная точка из переключателя
  // в шапке; можно выбрать группу площадок или всю сеть.
  const tx = useMemo(
    () => (transactions ?? []).filter((t) => inGymScope(gymScope, t.gymId)),
    [transactions, gymScope],
  )
  const byDay = useMemo(() => getRevenueByDay(tx, 30), [tx])
  const byMonth = useMemo(() => getRevenueByMonth(tx), [tx])
  const byGym = useMemo(() => getRevenueByGym(transactions ?? []), [transactions])
  const topTrainers = useMemo(() => getTopTrainersByRevenue(tx), [tx])
  const total = getTotalRevenue(tx)

  const points = granularity === 'day' ? byDay : byMonth

  const categoryTotals = useMemo(() => {
    const sums: Record<TransactionCategory, number> = { MEMBERSHIP: 0, PERSONAL: 0, GROUP: 0, ANCILLARY: 0, REFUND: 0 }
    for (const t of tx) sums[t.category] += t.amount
    return (Object.entries(sums) as [TransactionCategory, number][]).map(([category, value]) => ({ category, value }))
  }, [tx])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Выручка</h1>
          <p className="text-sm text-[var(--text-muted)]">По всей сети, по дням, по месяцам и по источникам дохода</p>
        </div>
        <NetworkGymFilter value={gymScope} onChange={setGymScope} />
      </div>

      <Card className="flex flex-wrap items-end gap-3">
        <div className="text-sm text-[var(--text-muted)]">Выгрузка для бухгалтерии (CSV, вся сеть)</div>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-faint)]">
          С
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[var(--text-faint)]">
          По
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
        </label>
        <Button size="sm" onClick={downloadCsv} disabled={downloading || !from || !to}>
          <Download size={14} /> {downloading ? 'Готовим…' : 'Скачать CSV'}
        </Button>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Выручка всего" value={fmt(total)} />
        {categoryTotals.map((c) => (
          <StatTile key={c.category} label={CATEGORY_LABELS[c.category]} value={fmt(c.value)} />
        ))}
      </div>

      <Card>
        <SectionTitle
          title="Динамика выручки"
          action={<Tabs value={granularity} onChange={setGranularity} options={[{ value: 'day', label: 'По дням' }, { value: 'month', label: 'По месяцам' }]} />}
        />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="key" fontSize={10} stroke="var(--text-faint)" tickFormatter={(v: string) => (granularity === 'day' ? v.slice(5) : v)} />
              <YAxis fontSize={11} stroke="var(--text-faint)" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: any) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => CATEGORY_LABELS[v as TransactionCategory] ?? v} />
              <Bar dataKey="MEMBERSHIP" stackId="a" fill={CATEGORY_COLORS.MEMBERSHIP} />
              <Bar dataKey="PERSONAL" stackId="a" fill={CATEGORY_COLORS.PERSONAL} />
              <Bar dataKey="GROUP" stackId="a" fill={CATEGORY_COLORS.GROUP} />
              <Bar dataKey="ANCILLARY" stackId="a" fill={CATEGORY_COLORS.ANCILLARY} />
              <Bar dataKey="REFUND" stackId="a" fill={CATEGORY_COLORS.REFUND} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          {/* Возвраты — отрицательная сумма, в круговой диаграмме долей источников не участвуют (показаны отдельно плиткой сверху и в динамике по дням/месяцам) */}
          <SectionTitle title="По источникам" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryTotals.filter((c) => c.category !== 'REFUND' && c.value > 0)} dataKey="value" nameKey="category" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {categoryTotals.filter((c) => c.category !== 'REFUND' && c.value > 0).map((c) => <Cell key={c.category} fill={CATEGORY_COLORS[c.category]} />)}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [fmt(v), CATEGORY_LABELS[n as TransactionCategory] ?? n]} />
                <Legend formatter={(v: string) => CATEGORY_LABELS[v as TransactionCategory] ?? v} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Топ тренеров по выручке" />
          <div className="flex flex-col gap-2.5">
            {topTrainers.map((t, idx) => {
              const max = topTrainers[0]?.revenue || 1
              return (
                <div key={t.trainerId} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-semibold text-[var(--text-faint)]">{idx + 1}</span>
                  {t.avatarHue !== undefined && <Avatar initials={getInitials(t.name)} hue={t.avatarHue} size={30} />}
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-[var(--text-muted)]">{fmt(t.revenue)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div className="h-full rounded-full bg-[var(--ceo-accent)]" style={{ width: `${(t.revenue / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {gymScope.length === 0 && byGym.length > 1 && (
        <Card>
          <SectionTitle title="Выручка по точкам" subtitle="Вся сеть одной сводкой, без переключения точки" />
          <div className="flex flex-col gap-2.5">
            {byGym.map((g) => {
              const max = byGym[0]?.total || 1
              return (
                <div key={g.gymId} className="flex items-center gap-3">
                  <div className="min-w-[120px] flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{g.name}</span>
                      <span className="text-[var(--text-muted)]">{fmt(g.total)}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div className="h-full rounded-full bg-[var(--ceo-accent)]" style={{ width: `${(g.total / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
