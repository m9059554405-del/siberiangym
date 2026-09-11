import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useTrainers } from '../../hooks/useClientApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { useAllWorkoutLogs, useTransactions } from '../../hooks/useCeoApi'
import { tariffById } from '../../data/tariffs'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Card, EmptyState, SectionTitle, StatTile } from '../../components/ui/Primitives'
import { formatMoney, getInitials } from '../../lib/format'
import type { ClientFormat, MembershipStatus } from '../../types'

const FORMAT_LABEL: Record<ClientFormat, string> = { PERSONAL: 'Персонально', GROUP: 'Группа', SELF: 'Самостоятельно' }
const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'danger'> = { ACTIVE: 'success', FROZEN: 'warning', EXPIRED: 'danger' }
const STATUS_LABEL: Record<MembershipStatus, string> = { ACTIVE: 'Активен', FROZEN: 'Заморожен', EXPIRED: 'Истёк' }

export function TrainerDetailPage() {
  const { trainerId } = useParams()
  const { data: trainers } = useTrainers()
  const { data: clients } = useAllClients()
  const { data: transactions } = useTransactions()
  const { data: logs } = useAllWorkoutLogs()

  const trainer = (trainers ?? []).find((t) => t.id === trainerId)
  const own = useMemo(() => (clients ?? []).filter((c) => c.trainerId === trainerId), [clients, trainerId])
  const payments = useMemo(() => (transactions ?? []).filter((t) => t.trainerId === trainerId).sort((a, b) => b.date.localeCompare(a.date)), [transactions, trainerId])
  const totalRevenue = payments.reduce((sum, t) => sum + t.amount, 0)

  function completionRate(clientId: string): number | null {
    const clientLogs = (logs ?? []).filter((l) => l.clientId === clientId).slice(-12)
    if (clientLogs.length === 0) return null
    const completed = clientLogs.filter((l) => l.status === 'COMPLETED').length
    return Math.round((completed / clientLogs.length) * 100)
  }

  if (!trainer) return <EmptyState title="Тренер не найден" />

  return (
    <div className="flex flex-col gap-5">
      <Link to="/ceo" className="flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
        <ArrowLeft size={15} /> К списку тренеров
      </Link>

      <Card className="flex items-center gap-3">
        <Avatar initials={getInitials(trainer.name)} hue={trainer.avatarHue} size={56} />
        <div>
          <div className="text-lg font-semibold">{trainer.name}</div>
          <div className="text-sm text-[var(--text-muted)]">{trainer.specialization} · {trainer.experienceYears} лет опыта</div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Подопечных" value={own.length} />
        <StatTile label="Выручка от тренера" value={`${formatMoney(totalRevenue)} ₽`} />
        <StatTile label="Платежей" value={payments.length} />
      </div>

      <Card>
        <SectionTitle title="Подопечные и результаты" subtitle="Формат, тариф, статус абонемента, выполнение программы" />
        <div className="flex flex-col gap-2">
          {own.map((c) => {
            const rate = completionRate(c.id)
            const tariffInfo = tariffById(c.tariff)
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={getInitials(c.name)} hue={c.avatarHue} size={34} />
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--text-faint)]">{FORMAT_LABEL[c.format]}{tariffInfo && ` · ${tariffInfo.name}`}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {rate !== null && <Badge tone={rate >= 70 ? 'success' : rate >= 40 ? 'warning' : 'danger'}>{rate}% выполнено</Badge>}
                  {c.membership && <Badge tone={STATUS_TONE[c.membership.status]}>{STATUS_LABEL[c.membership.status]}</Badge>}
                </div>
              </div>
            )
          })}
          {own.length === 0 && <EmptyState title="У тренера пока нет подопечных" />}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Платежи, связанные с тренером" subtitle="Персональные тренировки, тарифы, групповые занятия" />
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {payments.map((t) => (
            <div key={t.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{t.client?.name ?? '—'}</div>
                <div className="text-xs text-[var(--text-faint)]">{t.description} · {t.date.slice(0, 10)}</div>
              </div>
              <span className="font-semibold">{formatMoney(t.amount)} ₽</span>
            </div>
          ))}
          {payments.length === 0 && <EmptyState title="Платежей пока нет" />}
        </div>
      </Card>
    </div>
  )
}
