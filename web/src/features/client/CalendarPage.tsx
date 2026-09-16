import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, List, Lock } from 'lucide-react'
import {
  useCancelGroupClassBooking,
  useCancelPersonalSlot,
  useGroupClasses,
  useMe,
  usePersonalSlots,
  useTrainers,
} from '../../hooks/useClientApi'
import { useCreateCashOrder } from '../../hooks/useOrdersApi'
import { tariffUnlocksPersonalSlots } from '../../data/tariffs'
import { MonthCalendarGrid } from '../../components/MonthCalendarGrid'
import { Badge, Button, Card, EmptyState, Tabs } from '../../components/ui/Primitives'
import { OrderPendingNotice } from '../../components/OrderPendingNotice'
import { formatDateLabel, formatMoney } from '../../lib/format'
import type { Order } from '../../types'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CalendarPage() {
  const { data: client } = useMe()
  const { data: trainers } = useTrainers()
  const { data: groupClasses } = useGroupClasses()
  const { data: personalSlots } = usePersonalSlots()
  const createCashOrder = useCreateCashOrder()
  const cancelGroupClassBooking = useCancelGroupClassBooking()
  const cancelPersonalSlot = useCancelPersonalSlot()

  const [tab, setTab] = useState<'group' | 'personal'>('group')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [monthAnchor, setMonthAnchor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)

  function bookGroupClass(classId: string) {
    if (!client) return
    createCashOrder.mutate({ clientId: client.id, lines: [{ type: 'GROUP_CLASS_BOOKING', refId: classId }] }, { onSuccess: setPendingOrder })
  }

  function bookPersonalSlot(slotId: string) {
    if (!client) return
    createCashOrder.mutate({ clientId: client.id, lines: [{ type: 'PERSONAL_SLOT_BOOKING', refId: slotId }] }, { onSuccess: setPendingOrder })
  }

  const trainer = trainers?.find((t) => t.id === client?.trainerId)
  const hasIndividual = tariffUnlocksPersonalSlots(client?.tariff)
  const todayStr = todayIso()

  const classTypes = useMemo(() => Array.from(new Set((groupClasses ?? []).map((gc) => gc.type))), [groupClasses])

  const upcomingClassesAll = useMemo(
    () =>
      (groupClasses ?? [])
        .filter((gc) => gc.date.slice(0, 10) >= todayStr && (typeFilter === 'all' || gc.type === typeFilter))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    [groupClasses, typeFilter, todayStr],
  )
  const groupMarkers = useMemo(() => {
    const m: Record<string, number> = {}
    for (const gc of upcomingClassesAll) {
      const d = gc.date.slice(0, 10)
      m[d] = (m[d] ?? 0) + 1
    }
    return m
  }, [upcomingClassesAll])
  const upcomingClasses = useMemo(
    () => (viewMode === 'calendar' && selectedDate ? upcomingClassesAll.filter((gc) => gc.date.slice(0, 10) === selectedDate) : upcomingClassesAll.slice(0, 40)),
    [upcomingClassesAll, viewMode, selectedDate],
  )

  const personalSlotsAll = useMemo(
    () =>
      trainer
        ? (personalSlots ?? [])
            .filter((s) => s.trainerId === trainer.id && s.date.slice(0, 10) >= todayStr && (s.status === 'FREE' || s.clientId === client?.id))
            .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        : [],
    [personalSlots, trainer, client?.id, todayStr],
  )
  const personalMarkers = useMemo(() => {
    const m: Record<string, number> = {}
    for (const s of personalSlotsAll) {
      const d = s.date.slice(0, 10)
      m[d] = (m[d] ?? 0) + 1
    }
    return m
  }, [personalSlotsAll])
  const personalSlotsView = useMemo(
    () => (viewMode === 'calendar' && selectedDate ? personalSlotsAll.filter((s) => s.date.slice(0, 10) === selectedDate) : personalSlotsAll),
    [personalSlotsAll, viewMode, selectedDate],
  )

  if (!client) return null

  return (
    <div className="flex flex-col gap-4 pt-1">
      {pendingOrder && <OrderPendingNotice order={pendingOrder} onDismiss={() => setPendingOrder(null)} />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Календарь</h1>
          <p className="text-sm text-[var(--text-muted)]">Групповые и персональные тренировки</p>
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-[var(--surface-sunken)] p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`tap-scale flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-[var(--surface-raised)] shadow-sm' : 'text-[var(--text-muted)]'}`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => {
              setViewMode('calendar')
              setSelectedDate((d) => d ?? todayStr)
            }}
            className={`tap-scale flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${viewMode === 'calendar' ? 'bg-[var(--surface-raised)] shadow-sm' : 'text-[var(--text-muted)]'}`}
          >
            <CalendarDays size={14} />
          </button>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'group', label: 'Групповые' },
          { value: 'personal', label: 'Персональные' },
        ]}
      />

      {viewMode === 'calendar' && (
        <Card>
          <MonthCalendarGrid
            monthAnchor={monthAnchor}
            markers={tab === 'group' ? groupMarkers : personalMarkers}
            selectedDate={selectedDate}
            todayStr={todayStr}
            onSelectDate={setSelectedDate}
            onMonthChange={setMonthAnchor}
          />
        </Card>
      )}

      {tab === 'group' && (
        <div className="flex flex-col gap-3">
          {viewMode === 'list' && (
            <select
              className="w-fit rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">Все типы</option>
              {classTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {upcomingClasses.length === 0 && <EmptyState title="Нет занятий по фильтру" />}

          {upcomingClasses.map((gc) => {
            const t = trainers?.find((tr) => tr.id === gc.trainerId)
            const booked = gc.bookings.some((b) => b.clientId === client.id)
            const full = gc.bookings.length >= gc.capacity
            return (
              <Card key={gc.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{gc.type}</span>
                    {booked && <Badge tone="success">Вы записаны</Badge>}
                  </div>
                  <div className="mt-0.5 text-sm text-[var(--text-muted)]">
                    {formatDateLabel(gc.date)} · {gc.start}–{gc.end} · {gc.zone}
                  </div>
                  <div className="text-xs text-[var(--text-faint)]">
                    Тренер: {t?.name} · Мест: {gc.bookings.length}/{gc.capacity}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={booked ? 'danger' : 'primary'}
                  disabled={!booked && full}
                  onClick={() => (booked ? cancelGroupClassBooking.mutate(gc.id) : bookGroupClass(gc.id))}
                >
                  {booked ? 'Отменить' : full ? 'Нет мест' : 'Записаться'}
                </Button>
              </Card>
            )
          })}
        </div>
      )}

      {tab === 'personal' && (
        <div className="flex flex-col gap-3">
          {!trainer && (
            <EmptyState
              title="У вас нет персонального тренера"
              subtitle="Выберите тренера во вкладке «Тренер», чтобы записываться на персональные слоты"
            />
          )}
          {trainer && !hasIndividual && (
            <Card className="flex flex-col items-center gap-2 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)]">
                <Lock size={18} />
              </div>
              <p className="text-sm font-medium">Доступно с тарифом «Индивидуальные тренировки»</p>
              <p className="text-xs text-[var(--text-faint)]">Персональные тренировки с {trainer.name}</p>
              <Link to="/client/trainer">
                <Button size="sm" className="mt-1">
                  Выбрать тариф
                </Button>
              </Link>
            </Card>
          )}
          {trainer && hasIndividual && (
            <>
              <Card className="flex items-center justify-between">
                <div className="text-sm">
                  Ваш тренер: <span className="font-semibold">{trainer.name}</span> · {trainer.specialization}
                </div>
                <Link to="/client/trainer" className="text-xs font-medium text-[var(--accent-strong)]">
                  Сменить
                </Link>
              </Card>
              {personalSlotsView.length === 0 && <EmptyState title="Нет доступных слотов на ближайшее время" />}
              {personalSlotsView.map((slot) => {
                const isMine = slot.clientId === client.id
                return (
                  <Card key={slot.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{formatDateLabel(slot.date)}</span>
                        <span className="text-sm text-[var(--text-muted)]">{slot.start}–{slot.end}</span>
                        {isMine && <Badge tone="success">Ваша запись</Badge>}
                      </div>
                      <div className="text-xs text-[var(--text-faint)]">{formatMoney(trainer.personalSessionPrice)} ₽</div>
                    </div>
                    <Button
                      size="sm"
                      variant={isMine ? 'danger' : 'primary'}
                      onClick={() => (isMine ? cancelPersonalSlot.mutate(slot.id) : bookPersonalSlot(slot.id))}
                    >
                      {isMine ? 'Отменить' : 'Записаться'}
                    </Button>
                  </Card>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
