import { useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { usePricing, useTrainers } from '../../hooks/useClientApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { useUpdatePricing } from '../../hooks/useCeoApi'
import { getClientBaseBreakdown } from '../../lib/ceoSelectors'
import { Badge, Button, Card, SectionTitle, StatTile } from '../../components/ui/Primitives'
import { ClientOutreachList } from '../../components/ClientOutreachList'
import { formatMoney } from '../../lib/format'
import type { ClientFormat, MembershipPricing, MembershipStatus } from '../../types'

const PRICE_ROWS: { key: keyof MembershipPricing; networkKey: keyof MembershipPricing; label: string }[] = [
  { key: 'single', networkKey: 'singleNetwork', label: 'Разовое занятие' },
  { key: 'monthly', networkKey: 'monthlyNetwork', label: 'Абонемент на месяц' },
  { key: 'pack10', networkKey: 'pack10Network', label: 'Пакет на 10 занятий' },
  { key: 'pack20', networkKey: 'pack20Network', label: 'Пакет на 20 занятий' },
]

// Тарифы сопровождения (P4.2) — раньше константа из демо-версии в коде,
// теперь цена каждой точки; сетевого варианта у них нет.
const ESCORT_ROWS: { key: keyof MembershipPricing; label: string }[] = [
  { key: 'escortBasic', label: 'Тариф «Базовый»' },
  { key: 'escortCoaching', label: 'Тариф «Ведение»' },
  { key: 'escortIndividual', label: 'Тариф «Индивидуальные тренировки»' },
]

// Раньше цены можно было поменять только напрямую в базе — ни одной формы
// не существовало. Понадобилось для P1.2: без этого сетевые цены (второй
// столбец) было бы нечем настроить через приложение вообще.
function PricingSection() {
  const { data: pricing } = usePricing()
  const updatePricing = useUpdatePricing()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<MembershipPricing>>({})

  if (!pricing) return null

  function startEdit() {
    setDraft({
      single: pricing!.single, monthly: pricing!.monthly, pack10: pricing!.pack10, pack20: pricing!.pack20,
      singleNetwork: pricing!.singleNetwork, monthlyNetwork: pricing!.monthlyNetwork,
      pack10Network: pricing!.pack10Network, pack20Network: pricing!.pack20Network,
      escortBasic: pricing!.escortBasic, escortCoaching: pricing!.escortCoaching, escortIndividual: pricing!.escortIndividual,
    })
    setEditing(true)
  }

  function save() {
    updatePricing.mutate(draft, { onSuccess: () => setEditing(false) })
  }

  return (
    <Card>
      <SectionTitle
        title="Тарифы абонементов"
        subtitle="Цена на этой точке и, если настроена, на всей сети (P1.2)"
        action={
          editing ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>Отмена</Button>
              <Button size="sm" onClick={save} disabled={updatePricing.isPending}>Сохранить</Button>
            </div>
          ) : (
            <Button size="sm" variant="secondary" onClick={startEdit}>Изменить</Button>
          )
        }
      />
      <div className="flex flex-col gap-2">
        {PRICE_ROWS.map(({ key, networkKey, label }) => (
          <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
            <span>{label}</span>
            {editing ? (
              <input
                type="number" min={0} value={(draft[key] as number) ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                className="w-24 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
              />
            ) : (
              <span className="font-medium">{formatMoney(pricing[key] as number)} ₽</span>
            )}
            {editing ? (
              <input
                type="number" min={0} placeholder="вся сеть" value={(draft[networkKey] as number | null) ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [networkKey]: e.target.value === '' ? null : Number(e.target.value) }))}
                className="w-28 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
              />
            ) : (
              <span className="text-xs text-[var(--text-faint)]">
                {pricing[networkKey] != null ? `вся сеть — ${formatMoney(pricing[networkKey] as number)} ₽` : 'вся сеть — не настроено'}
              </span>
            )}
          </div>
        ))}
        {ESCORT_ROWS.map(({ key, label }) => (
          <div key={key} className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
            <span>{label}</span>
            {editing ? (
              <input
                type="number" min={0} value={(draft[key] as number) ?? 0}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: Number(e.target.value) }))}
                className="w-24 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
              />
            ) : (
              <span className="font-medium">{formatMoney(pricing[key] as number)} ₽</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}

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

      <PricingSection />

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
