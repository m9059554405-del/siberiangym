import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import { useTransactions, useTransactionSummary } from '../../hooks/useCeoApi'
import { useAuthStore } from '../../store/useAuthStore'
import { NetworkGymFilter, defaultGymScope } from './NetworkGymFilter'
import { Avatar } from '../../components/ui/Avatar'
import { Button, Card, EmptyState, SectionTitle, StatTile, Tabs } from '../../components/ui/Primitives'
import { getInitials } from '../../lib/format'
import type { TransactionCategory } from '../../types'

// P3.19: аналитика (суммы, графики, топы) считается СЕРВЕРОМ по всей
// истории (/transactions/summary), реестр подгружается постранично
// (/transactions?page=...) — объём ответа больше не растёт с историей
// клуба, а цифры не зависят от того, сколько строк загружено на экране.

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  MEMBERSHIP: 'Абонементы', PERSONAL: 'Персональные', GROUP: 'Групповые', ANCILLARY: 'Сопутствующие', REFUND: 'Возвраты',
}
const CATEGORY_COLORS: Record<TransactionCategory, string> = {
  MEMBERSHIP: 'var(--ceo-accent)', PERSONAL: '#3b82f6', GROUP: '#7dd3fc', ANCILLARY: '#bfdbfe', REFUND: '#ef4444',
}
const CATEGORIES: TransactionCategory[] = ['MEMBERSHIP', 'PERSONAL', 'GROUP', 'ANCILLARY', 'REFUND']

function fmt(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

const REGISTRY_PAGE_SIZE = 20

export function RevenuePage() {
  const [granularity, setGranularity] = useState<'day' | 'month'>('day')
  const [gymScope, setGymScope] = useState<string[]>(defaultGymScope)
  const { data: summary } = useTransactionSummary(gymScope)

  // Реестр последних транзакций — постранично, тем же фильтром точек.
  const [page, setPage] = useState(1)
  const feed = useTransactions(page, REGISTRY_PAGE_SIZE, { gymIds: gymScope })

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

  if (!summary) return null

  const points = granularity === 'day' ? summary.byDay : summary.byMonth
  const categoryTiles = CATEGORIES.map((category) => ({ category, value: summary.byCategory[category] }))
  const topTrainers = summary.byTrainer.slice(0, 10)
  const totalPages = feed.data ? Math.max(1, Math.ceil(feed.data.total / REGISTRY_PAGE_SIZE)) : 1

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Выручка</h1>
          <p className="text-sm text-[var(--text-muted)]">По всей сети, по дням, по месяцам и по источникам дохода</p>
        </div>
        <NetworkGymFilter value={gymScope} onChange={(scope) => { setGymScope(scope); setPage(1) }} />
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
        <StatTile label="Выручка всего" value={fmt(summary.total)} />
        {categoryTiles.map((c) => (
          <StatTile key={c.category} label={CATEGORY_LABELS[c.category]} value={fmt(c.value)} />
        ))}
      </div>

      <Card>
        <SectionTitle
          title="Динамика выручки"
          subtitle="Дни — за последние 30 дней, месяцы — за всю историю"
          action={<Tabs value={granularity} onChange={setGranularity} options={[{ value: 'day', label: 'По дням' }, { value: 'month', label: 'По месяцам' }]} />}
        />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="key" fontSize={10} stroke="var(--text-faint)" tickFormatter={(v: string) => (granularity === 'day' ? v.slice(5) : v)} />
              <YAxis fontSize={11} stroke="var(--text-faint)" tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v: any) => fmt(v as number)} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => CATEGORY_LABELS[v as TransactionCategory] ?? v} />
              {CATEGORIES.map((c, idx) => (
                <Bar key={c} dataKey={c} stackId="a" fill={CATEGORY_COLORS[c]} radius={idx === CATEGORIES.length - 1 ? [4, 4, 0, 0] : undefined} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          {/* Возвраты — отрицательная сумма, в круговой диаграмме долей источников не участвуют (показаны отдельно плиткой сверху и в динамике) */}
          <SectionTitle title="По источникам" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryTiles.filter((c) => c.category !== 'REFUND' && c.value > 0)} dataKey="value" nameKey="category" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {categoryTiles.filter((c) => c.category !== 'REFUND' && c.value > 0).map((c) => <Cell key={c.category} fill={CATEGORY_COLORS[c.category]} />)}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [fmt(v as number), CATEGORY_LABELS[n as TransactionCategory] ?? n]} />
                <Legend formatter={(v: string) => CATEGORY_LABELS[v as TransactionCategory] ?? v} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Топ тренеров по выручке" subtitle="Считается сервером по всей истории" />
          <div className="flex flex-col gap-2.5">
            {topTrainers.map((t, idx) => {
              const max = topTrainers[0]?.revenue || 1
              return (
                <div key={t.trainerId} className="flex items-center gap-3">
                  <span className="w-4 text-xs font-semibold text-[var(--text-faint)]">{idx + 1}</span>
                  <Avatar initials={getInitials(t.name)} hue={t.avatarHue} size={30} />
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
            {topTrainers.length === 0 && <EmptyState title="Платежей с тренерами пока нет" />}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Реестр транзакций"
          subtitle={feed.data ? `Страница ${feed.data.page} из ${totalPages} · всего ${feed.data.total}` : 'Загрузка…'}
        />
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {(feed.data?.items ?? []).map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{t.client?.name ?? '—'}</div>
                <div className="text-xs text-[var(--text-faint)]">{t.description} · {t.date.slice(0, 10)}{t.gym?.name ? ` · ${t.gym.name}` : ''}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[var(--surface-raised)] px-2 py-0.5 text-xs text-[var(--text-muted)]">{CATEGORY_LABELS[t.category] ?? t.category}</span>
                <span className={`font-semibold ${t.amount < 0 ? 'text-red-600' : ''}`}>{fmt(t.amount)}</span>
              </div>
            </div>
          ))}
          {feed.data && feed.data.items.length === 0 && <EmptyState title="Транзакций пока нет" />}
        </div>
        {feed.data && feed.data.total > REGISTRY_PAGE_SIZE && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <Button size="sm" variant="secondary" disabled={page <= 1 || feed.isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={14} /> Назад
            </Button>
            <span className="text-sm text-[var(--text-faint)]">{page} / {totalPages}</span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages || feed.isFetching} onClick={() => setPage((p) => p + 1)}>
              Вперёд <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </Card>

      {gymScope.length === 0 && summary.byGym.length > 1 && (
        <Card>
          <SectionTitle title="Выручка по точкам" subtitle="Вся сеть одной сводкой, без переключения точки" />
          <div className="flex flex-col gap-2.5">
            {summary.byGym.map((g) => {
              const max = summary.byGym[0]?.total || 1
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
