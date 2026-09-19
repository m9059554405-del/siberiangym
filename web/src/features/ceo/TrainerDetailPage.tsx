import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, ChevronLeft, ChevronRight, Plus, ShieldCheck, X } from 'lucide-react'
import { useTrainers } from '../../hooks/useClientApi'
import { useCreateTrainerCredential, useDeleteTrainerCredential, useUpdateTrainerCredential } from '../../hooks/useCeoApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { useAllWorkoutLogs, useAssignTrainerGym, useBulkTrainerClients, useBulkTrainerSlots, useSetTrainerAvailability, useTransactionSummary, useTransactions, useTrainerGyms, useUnassignTrainerGym } from '../../hooks/useCeoApi'
import { useNetworkGyms } from '../../hooks/useGymsApi'
import { useGrantTrainerConsent, useTrainerConsent } from '../../hooks/useConsentsApi'
import { tariffById } from '../../data/tariffs'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, EmptyState, SectionTitle, StatTile } from '../../components/ui/Primitives'
import { formatDateLong, formatMoney, getInitials } from '../../lib/format'
import type { ClientFormat, EmploymentType, MembershipStatus, Trainer } from '../../types'

const FORMAT_LABEL: Record<ClientFormat, string> = { PERSONAL: 'Персонально', GROUP: 'Группа', SELF: 'Самостоятельно' }
const STATUS_TONE: Record<MembershipStatus, 'success' | 'warning' | 'danger'> = { ACTIVE: 'success', FROZEN: 'warning', EXPIRED: 'danger' }
const STATUS_LABEL: Record<MembershipStatus, string> = { ACTIVE: 'Активен', FROZEN: 'Заморожен', EXPIRED: 'Истёк' }
const EMPLOYMENT_LABEL: Record<EmploymentType, string> = { EMPLOYEE: 'Штатный сотрудник', SELF_EMPLOYED: 'Самозанятый', SOLE_PROPRIETOR: 'ИП' }

// Согласие тренера-сотрудника на обработку ПДн (P1.4, STAFF_PDN) — тот же
// read-only аудит + возможность зафиксировать по факту бумаги, что и у
// законного представителя в ClientsManagePage (P0.6).
function TrainerConsentSection({ trainerId }: { trainerId: string }) {
  const { data } = useTrainerConsent(trainerId)
  const grant = useGrantTrainerConsent()
  if (!data) return null
  return (
    <Card>
      <SectionTitle title="Согласие сотрудника" subtitle="Обработка персональных данных как сотрудника (P1.4)" />
      {data.granted ? (
        <Badge tone="success"><ShieldCheck size={12} className="mr-1" /> Подписано</Badge>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => grant.mutate(trainerId)} disabled={grant.isPending}>
          Зафиксировать согласие
        </Button>
      )}
    </Card>
  )
}

// Точки сети, на которых работает тренер (P1.3) — домашняя (где заведена
// карточка) плюс любое число дополнительных, назначенных здесь. Список
// доступных для назначения — вся сеть CEO, за вычетом уже назначенных.
function TrainerAvailabilitySection({ trainerId, trainer }: { trainerId: string; trainer: { unavailableFrom: string | null; unavailableUntil: string | null; departedAt: string | null } }) {
  const setAvailability = useSetTrainerAvailability(trainerId)
  const bulkSlots = useBulkTrainerSlots(trainerId)
  const bulkClients = useBulkTrainerClients(trainerId)
  const { data: trainers } = useTrainers()
  const [from, setFrom] = useState(trainer.unavailableFrom?.slice(0, 10) ?? '')
  const [until, setUntil] = useState(trainer.unavailableUntil?.slice(0, 10) ?? '')
  const [targetTrainerId, setTargetTrainerId] = useState('')
  const others = (trainers ?? []).filter((t) => t.id !== trainerId && !t.departedAt)

  return (
    <Card>
      <SectionTitle title="Отсутствие и уход" subtitle={trainer.departedAt ? 'Тренер отмечен как ушедший' : 'Массовая обработка расписания и подопечных'} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">С <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ml-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1.5" /></label>
          <label className="text-sm">По <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="ml-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1.5" /></label>
          <Button size="sm" disabled={!from || !until || setAvailability.isPending} onClick={() => setAvailability.mutate({ mode: 'UNAVAILABLE', from, until })}>Отметить отсутствие</Button>
          <Button size="sm" variant="secondary" disabled={setAvailability.isPending} onClick={() => setAvailability.mutate({ mode: 'ACTIVE' })}>Вернуть активность</Button>
          <Button size="sm" variant="danger" disabled={!!trainer.departedAt || setAvailability.isPending} onClick={() => setAvailability.mutate({ mode: 'DEPARTED' })}>Зафиксировать уход</Button>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
          <select value={targetTrainerId} onChange={(e) => setTargetTrainerId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
            <option value="">Выбрать нового тренера…</option>
            {others.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Button size="sm" disabled={!targetTrainerId || bulkSlots.isPending} onClick={() => bulkSlots.mutate({ action: 'REASSIGN', targetTrainerId })}>Переназначить слоты</Button>
          <Button size="sm" variant="secondary" disabled={bulkSlots.isPending} onClick={() => bulkSlots.mutate({ action: 'CANCEL' })}>Отменить слоты</Button>
          <Button size="sm" disabled={!targetTrainerId || bulkClients.isPending} onClick={() => bulkClients.mutate({ action: 'REASSIGN', targetTrainerId })}>Переназначить подопечных</Button>
          <Button size="sm" variant="secondary" disabled={bulkClients.isPending} onClick={() => bulkClients.mutate({ action: 'SELF' })}>Перевести взрослых на самостоятельные</Button>
        </div>
      </div>
    </Card>
  )
}

function TrainerCredentialsSection({ trainerId, credentials }: { trainerId: string; credentials: Trainer['credentials'] }) {
  const create = useCreateTrainerCredential(trainerId)
  const update = useUpdateTrainerCredential(trainerId)
  const remove = useDeleteTrainerCredential(trainerId)
  const [title, setTitle] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [isRequired, setIsRequired] = useState(false)

  return (
    <Card>
      <SectionTitle title="Сертификаты" subtitle="Срок действия контролируется за 30 дней до истечения; просрочка только предупреждает CEO" />
      <div className="flex flex-col gap-2">
        {credentials.map((credential) => {
          const expired = credential.expiresAt && new Date(credential.expiresAt) < new Date()
          const soon = credential.expiresAt && !expired && new Date(credential.expiresAt).getTime() <= Date.now() + 30 * 86400000
          return (
            <div key={credential.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
              <div>
                <div className="text-sm font-medium">{credential.title} {credential.isRequired && <Badge tone="accent">обязательный</Badge>}</div>
                <div className="text-xs text-[var(--text-faint)]">{credential.issuedBy ?? ''} {credential.year ? `· ${credential.year}` : ''}{credential.expiresAt ? ` · до ${formatDateLong(credential.expiresAt)}` : ' · срок не указан'}</div>
              </div>
              <div className="flex items-center gap-2">
                {expired && <Badge tone="danger">просрочен</Badge>}
                {soon && <Badge tone="warning">истекает скоро</Badge>}
                {credential.expiresAt && <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: credential.id, expiresAt: null })}>Сбросить срок</Button>}
                <Button size="sm" variant="danger" onClick={() => remove.mutate(credential.id)} disabled={remove.isPending}>Удалить</Button>
              </div>
            </div>
          )
        })}
        <div className="flex flex-wrap items-end gap-2 border-t border-[var(--border)] pt-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название сертификата" className="min-w-48 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} /> обязательный</label>
          <Button size="sm" disabled={!title.trim() || create.isPending} onClick={() => create.mutate({ title: title.trim(), expiresAt: expiresAt || undefined, isRequired }, { onSuccess: () => { setTitle(''); setExpiresAt(''); setIsRequired(false) } })}>Добавить</Button>
        </div>
      </div>
    </Card>
  )
}

function TrainerGymsSection({ trainerId }: { trainerId: string }) {
  const { data } = useTrainerGyms(trainerId)
  const { data: networkGyms } = useNetworkGyms()
  const assign = useAssignTrainerGym(trainerId)
  const unassign = useUnassignTrainerGym(trainerId)
  const [selected, setSelected] = useState('')

  if (!data) return null

  const assignedIds = new Set([data.homeGymId, ...data.additional.map((g) => g.id)])
  const available = (networkGyms ?? []).filter((g) => !assignedIds.has(g.id))
  const homeGym = (networkGyms ?? []).find((g) => g.id === data.homeGymId)

  return (
    <Card>
      <SectionTitle title="Точки сети" subtitle="Где тренер ведёт занятия (P1.3)" />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5"><Building2 size={14} /> {homeGym?.name ?? 'Домашняя точка'}</span>
          <Badge tone="accent">домашняя</Badge>
        </div>
        {data.additional.map((g) => (
          <div key={g.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
            <span className="flex items-center gap-1.5"><Building2 size={14} /> {g.name}</span>
            <Button size="sm" variant="ghost" onClick={() => unassign.mutate(g.id)} disabled={unassign.isPending}>
              <X size={13} /> Снять
            </Button>
          </div>
        ))}
        {available.length > 0 && (
          <div className="flex gap-2 pt-1">
            <select value={selected} onChange={(e) => setSelected(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
              <option value="">Выбрать точку…</option>
              {available.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <Button size="sm" variant="secondary" disabled={!selected || assign.isPending}
              onClick={() => { assign.mutate(selected); setSelected('') }}>
              <Plus size={14} /> Добавить
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

export function TrainerDetailPage() {
  const { trainerId } = useParams()
  const { data: trainers } = useTrainers()
  const { data: clients } = useAllClients()
  // P3.19: выручка/число платежей тренера — серверный агрегат по всей
  // истории; список платежей — пагинированный реестр с фильтром trainerId.
  const { data: revenueSummary } = useTransactionSummary()
  const [paymentsPage, setPaymentsPage] = useState(1)
  const paymentsFeed = useTransactions(paymentsPage, 20, { trainerId })
  const { data: logs } = useAllWorkoutLogs()

  const trainer = (trainers ?? []).find((t) => t.id === trainerId)
  const own = useMemo(() => (clients ?? []).filter((c) => c.trainerId === trainerId), [clients, trainerId])
  const trainerRevenueRow = revenueSummary?.byTrainer.find((t) => t.trainerId === trainerId)
  const payments = paymentsFeed.data?.items ?? []
  const totalRevenue = trainerRevenueRow?.revenue ?? 0
  const paymentsTotal = trainerRevenueRow?.payments ?? paymentsFeed.data?.total ?? 0
  const paymentsTotalPages = paymentsFeed.data ? Math.max(1, Math.ceil(paymentsFeed.data.total / 20)) : 1

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
          {trainer.employmentType && <Badge tone="accent">{EMPLOYMENT_LABEL[trainer.employmentType]}</Badge>}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Подопечных" value={own.length} />
        <StatTile label="Выручка от тренера" value={`${formatMoney(totalRevenue)} ₽`} />
        <StatTile label="Платежей" value={paymentsTotal} />
        {trainer.revenueSharePercent != null && (
          <StatTile
            label="Причитается тренеру"
            value={`${formatMoney(Math.round((totalRevenue * trainer.revenueSharePercent) / 100))} ₽`}
            hint={`${trainer.revenueSharePercent}% от выручки`}
          />
        )}
      </div>

      <TrainerGymsSection trainerId={trainer.id} />
      <TrainerCredentialsSection trainerId={trainer.id} credentials={trainer.credentials} />
      <TrainerAvailabilitySection trainerId={trainer.id} trainer={trainer} />
      <TrainerConsentSection trainerId={trainer.id} />

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
        <SectionTitle
          title="Платежи, связанные с тренером"
          subtitle="Персональные тренировки, тарифы, групповые занятия"
          action={paymentsFeed.data && paymentsFeed.data.total > 20 ? <span className="text-xs text-[var(--text-faint)]">{paymentsPage} / {paymentsTotalPages}</span> : undefined}
        />
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
        {paymentsFeed.data && paymentsFeed.data.total > 20 && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <Button size="sm" variant="secondary" disabled={paymentsPage <= 1 || paymentsFeed.isFetching} onClick={() => setPaymentsPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft size={14} /> Назад
            </Button>
            <Button size="sm" variant="secondary" disabled={paymentsPage >= paymentsTotalPages || paymentsFeed.isFetching} onClick={() => setPaymentsPage((p) => p + 1)}>
              Вперёд <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
