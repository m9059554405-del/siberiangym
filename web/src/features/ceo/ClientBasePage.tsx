import { useMemo } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useTrainers } from '../../hooks/useClientApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { getClientBaseBreakdown } from '../../lib/ceoSelectors'
import { Badge, Card, SectionTitle, StatTile } from '../../components/ui/Primitives'
import { ClientOutreachList } from '../../components/ClientOutreachList'
import type { ClientFormat, MembershipStatus } from '../../types'

const FORMAT_LABELS: Record<ClientFormat, string> = { PERSONAL: 'Персонально', GROUP: 'Группы', SELF: 'Самостоятельно' }
const FORMAT_COLORS: Record<ClientFormat, string> = { PERSONAL: 'var(--ceo-accent)', GROUP: '#3b82f6', SELF: '#93c5fd' }

const STATUS_LABELS: Record<MembershipStatus, string> = { ACTIVE: 'Активен', EXPIRED: 'Истёк', FROZEN: 'Заморожен' }
const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'danger'> = { ACTIVE: 'success', FROZEN: 'warning', EXPIRED: 'danger' }

export function ClientBasePage() {
  const { data: clients } = useAllClients()
  const { data: trainers } = useTrainers()

  const list = clients ?? []
  const breakdown = getClientBaseBreakdown(list)
  const total = list.length

  const formatData = (['PERSONAL', 'GROUP', 'SELF'] as ClientFormat[]).map((f) => ({ format: f, value: breakdown[f] }))

  const statusCounts = useMemo(() => {
    const counts: Record<MembershipStatus, number> = { ACTIVE: 0, EXPIRED: 0, FROZEN: 0 }
    for (const c of list) if (c.membership) counts[c.membership.status]++
    return counts
  }, [list])

  const switched = list.filter((c) => (c.formatHistory?.length ?? 0) > 1)

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Клиентская база</h1>
        <p className="text-sm text-[var(--text-muted)]">Общий обзор по формату занятий и статусу абонементов</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Всего клиентов" value={total} />
        <StatTile label="Активные абонементы" value={statusCounts.ACTIVE} />
        <StatTile label="Меняли тренера/формат" value={switched.length} hint="за последние месяцы" />
        <StatTile label="Самостоятельных" value={breakdown.SELF} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <SectionTitle title="Формат занятий" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={formatData} dataKey="value" nameKey="format" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {formatData.map((d) => <Cell key={d.format} fill={FORMAT_COLORS[d.format]} />)}
                </Pie>
                <Tooltip formatter={(v: any, n: any) => [`${v} клиентов`, FORMAT_LABELS[n as ClientFormat] ?? n]} />
                <Legend formatter={(v: string) => FORMAT_LABELS[v as ClientFormat] ?? v} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Статус абонементов" />
          <div className="flex flex-col gap-3">
            {(['ACTIVE', 'FROZEN', 'EXPIRED'] as MembershipStatus[]).map((st) => (
              <div key={st} className="flex items-center justify-between">
                <Badge tone={STATUS_TONE[st]}>{STATUS_LABELS[st]}</Badge>
                <div className="flex flex-1 items-center gap-2 px-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div className="h-full rounded-full bg-[var(--ceo-accent)]" style={{ width: total ? `${(statusCounts[st] / total) * 100}%` : '0%' }} />
                  </div>
                </div>
                <span className="w-8 text-right text-sm font-medium">{statusCounts[st]}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Клиенты со сменой тренера или формата" subtitle="История видна тренерам и в профиле клиента" />
        <div className="flex flex-col gap-2">
          {switched.map((c) => {
            const history = c.formatHistory ?? []
            const prev = history[history.length - 2]
            const curr = history[history.length - 1]
            const prevTrainer = (trainers ?? []).find((t) => t.id === prev?.trainerId)
            const currTrainer = (trainers ?? []).find((t) => t.id === curr?.trainerId)
            return (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-[var(--text-muted)]">
                  {FORMAT_LABELS[prev.format]} ({prevTrainer?.name ?? '—'}) → {FORMAT_LABELS[curr.format]} ({currTrainer?.name ?? '—'})
                  <span className="ml-2 text-xs text-[var(--text-faint)]">с {curr.from.slice(0, 10)}</span>
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      <ClientOutreachList canEdit={false} />
    </div>
  )
}
