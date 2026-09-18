import { useState } from 'react'
import { CalendarClock, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useTrainers } from '../../hooks/useClientApi'
import {
  useCancelGroupClassSeries,
  useCreateGroupClassSeries,
  useGroupClassSeries,
  useRegenerateGroupClassSeries,
  useUpdateGroupClassSeries,
  type SeriesGenerationResult,
} from '../../hooks/useCeoApi'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import type { GroupClassSeries } from '../../types'

// Серии регулярных групповых занятий (P2.12): CEO/STAFF задаёт шаблон
// («Йога, Пн и Чт 19:00»), API сам создаёт занятия на горизонт вперёд и
// поддерживает его скользящим окном. Отдельные occurrence с записями
// клиентов при редактировании серии не пересоздаются — клиент купил
// конкретное занятие (см. schedule.service.ts).

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] // индекс 0=Пн, как в API

const inputCls =
  'rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const labelCls = 'flex flex-col gap-1 text-xs text-[var(--text-faint)]'

function fmtDate(iso: string) {
  return iso.slice(0, 10).split('-').reverse().join('.')
}

interface FormState {
  type: string
  trainerId: string
  zone: string
  start: string
  end: string
  capacity: string
  weekdays: number[]
  startDate: string
  endDate: string
  horizonDays: string
}

const EMPTY_FORM: FormState = {
  type: '',
  trainerId: '',
  zone: '',
  start: '18:00',
  end: '19:00',
  capacity: '12',
  weekdays: [],
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  horizonDays: '28',
}

function SeriesFormModal({
  series,
  open,
  onClose,
  onGenerated,
}: {
  series: GroupClassSeries | null // null — создание, объект — редактирование
  open: boolean
  onClose: () => void
  onGenerated: (result: SeriesGenerationResult) => void
}) {
  const { data: trainers } = useTrainers()
  const create = useCreateGroupClassSeries()
  const update = useUpdateGroupClassSeries()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [loadedId, setLoadedId] = useState<string | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  // Поля перезаливаются при каждом новом открытии (создание или другая серия).
  if (open && loadedId !== (series?.id ?? null)) {
    setLoadedId(series?.id ?? null)
    setForm(
      series
        ? {
            type: series.type,
            trainerId: series.trainerId,
            zone: series.zone,
            start: series.start,
            end: series.end,
            capacity: String(series.capacity),
            weekdays: [...series.weekdays],
            startDate: series.startDate.slice(0, 10),
            endDate: series.endDate ? series.endDate.slice(0, 10) : '',
            horizonDays: String(series.horizonDays),
          }
        : EMPTY_FORM,
    )
    setError(null)
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function toggleWeekday(i: number) {
    setForm((f) => ({
      ...f,
      weekdays: f.weekdays.includes(i) ? f.weekdays.filter((d) => d !== i) : [...f.weekdays, i].sort((a, b) => a - b),
    }))
  }

  function submit() {
    if (!form.type.trim() || !form.trainerId || form.weekdays.length === 0) return
    setError(null)
    const dto = {
      type: form.type.trim(),
      trainerId: form.trainerId,
      zone: form.zone.trim(),
      start: form.start,
      end: form.end,
      capacity: Number(form.capacity),
      weekdays: form.weekdays,
      startDate: form.startDate,
      endDate: form.endDate || null,
      horizonDays: Number(form.horizonDays) || 28,
    }
    const opts = {
      onSuccess: (res: { generation: SeriesGenerationResult }) => {
        onGenerated(res.generation)
        onClose()
      },
      onError: (err: Error) => setError(err instanceof ApiError ? err.message : 'Не удалось сохранить серию'),
    }
    if (series) update.mutate({ id: series.id, dto }, opts)
    else create.mutate(dto, opts)
  }

  const busy = create.isPending || update.isPending

  return (
    <Modal open={open} onClose={onClose} title={series ? 'Изменить серию' : 'Новая серия занятий'}>
      <div className="flex flex-col gap-3">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <input value={form.type} onChange={(e) => set('type', e.target.value)} placeholder="Название (напр. Йога)"
          className={inputCls} />
        <div className="grid grid-cols-2 gap-3">
          <select value={form.trainerId} onChange={(e) => set('trainerId', e.target.value)} className={inputCls} aria-label="Тренер">
            <option value="">Тренер…</option>
            {(trainers ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <input value={form.zone} onChange={(e) => set('zone', e.target.value)} placeholder="Зона (зал 1)" className={inputCls} />
        </div>
        <div>
          <div className="mb-1 text-xs text-[var(--text-faint)]">Дни недели</div>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleWeekday(i)}
                className={
                  'tap-scale rounded-lg px-3 py-1.5 text-sm font-medium ' +
                  (form.weekdays.includes(i)
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]')
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className={labelCls}>
            Начало
            <input type="time" value={form.start} onChange={(e) => set('start', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Конец
            <input type="time" value={form.end} onChange={(e) => set('end', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Мест
            <input type="number" min={1} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label className={labelCls}>
            С даты
            <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            По дату (необяз.)
            <input type="date" value={form.endDate} onChange={(e) => set('endDate', e.target.value)} className={inputCls} />
          </label>
          <label className={labelCls}>
            Горизонт, дней
            <input type="number" min={7} max={90} value={form.horizonDays} onChange={(e) => set('horizonDays', e.target.value)} className={inputCls} />
          </label>
        </div>
        <p className="text-xs text-[var(--text-faint)]">
          {series
            ? 'Будущие занятия серии без записей клиентов будут пересозданы по новому шаблону; занятия с записями не трогаются.'
            : 'Занятия создаются автоматически от даты старта на горизонт вперёд и далее поддерживаются скользящим окном.'}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button
            className="flex-1"
            onClick={submit}
            disabled={busy || !form.type.trim() || !form.trainerId || form.weekdays.length === 0}
          >
            <Plus size={14} /> {series ? 'Сохранить' : 'Создать серию'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function CancelSeriesModal({ series, onClose }: { series: GroupClassSeries | null; onClose: () => void }) {
  const cancel = useCancelGroupClassSeries()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ removedOccurrences: number; cancelledWithBookings: number } | null>(null)

  function submit() {
    if (!series) return
    setError(null)
    cancel.mutate(series.id, {
      onSuccess: (res) => setResult({ removedOccurrences: res.removedOccurrences, cancelledWithBookings: res.cancelledWithBookings }),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось отменить серию'),
    })
  }

  function close() {
    setResult(null)
    setError(null)
    onClose()
  }

  return (
    <Modal open={!!series} onClose={close} title="Отменить серию">
      <div className="flex flex-col gap-3">
        {result ? (
          <p className="text-sm text-[var(--text-muted)]">
            Серия отменена. Удалено будущих занятий: {result.removedOccurrences},
            из них с записями клиентов: {result.cancelledWithBookings} — этим клиентам отправлены уведомления.
          </p>
        ) : (
          <p className="text-sm text-[var(--text-muted)]">
            Отменить серию «{series?.type}» целиком? Будущие занятия без записей удалятся молча,
            занятия с записями клиентов отменятся с уведомлением каждому (возврат оплаты — вручную через возврат по заказу).
            Новые занятия генерироваться больше не будут.
          </p>
        )}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={close}>Закрыть</Button>
          {!result && (
            <Button variant="danger" className="flex-1" onClick={submit} disabled={cancel.isPending}>
              <Trash2 size={14} /> Отменить серию
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function SeriesPage() {
  const { data: series } = useGroupClassSeries()
  const regenerate = useRegenerateGroupClassSeries()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<GroupClassSeries | null>(null)
  const [cancelTarget, setCancelTarget] = useState<GroupClassSeries | null>(null)
  const [lastResult, setLastResult] = useState<SeriesGenerationResult | null>(null)

  function onRegenerate(s: GroupClassSeries) {
    regenerate.mutate(s.id, { onSuccess: setLastResult })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Серии занятий</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Регулярное расписание: задания создаются автоматически на несколько недель вперёд
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Новая серия
        </Button>
      </div>

      <SeriesFormModal series={editTarget} open={createOpen || !!editTarget}
        onClose={() => { setCreateOpen(false); setEditTarget(null) }} onGenerated={setLastResult} />
      <CancelSeriesModal series={cancelTarget} onClose={() => setCancelTarget(null)} />

      {lastResult && (
        <Card className="border border-[var(--accent)]">
          <SectionTitle
            title={`Генерация: создано занятий ${lastResult.created.length}, пропущено ${lastResult.skipped.length}`}
            subtitle={lastResult.skipped.length > 0 ? 'Пропущенные даты (не мешают серии — добираются кнопкой «Перегенерировать», когда обстоятельства изменятся)' : undefined}
            action={
              <Button size="sm" variant="ghost" onClick={() => setLastResult(null)}>Скрыть</Button>
            }
          />
          {lastResult.skipped.length > 0 && (
            <div className="flex flex-col gap-1">
              {lastResult.skipped.slice(0, 10).map((s) => (
                <div key={s.date} className="flex justify-between gap-3 text-sm">
                  <span className="text-[var(--text-muted)]">{fmtDate(s.date)}</span>
                  <span className="text-[var(--text-faint)]">{s.reason}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {(series ?? []).length === 0 && (
        <EmptyState
          title="Серий пока нет"
          subtitle="Создайте шаблон — например, «Йога по Пн и Чт в 19:00» — и занятия будут появляться сами"
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {(series ?? []).map((s) => {
          const cancelled = !!s.cancelledAt
          const booked = s.occurrences.filter((o) => o._count.bookings > 0)
          return (
            <Card key={s.id} className={cancelled ? 'opacity-70' : ''}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CalendarClock size={18} className="text-[var(--text-faint)]" />
                  <div>
                    <div className="font-semibold">{s.type}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {s.trainer?.name ?? '—'} · {s.zone} · {s.start}–{s.end} · {s.capacity} мест
                    </div>
                  </div>
                </div>
                {cancelled ? <Badge tone="danger">отменена</Badge> : <Badge tone="success">активна</Badge>}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {WEEKDAYS.map((label, i) => (
                  <Badge key={label} tone={s.weekdays.includes(i) ? 'accent' : 'neutral'}>{label}</Badge>
                ))}
                <span className="self-center text-xs text-[var(--text-faint)]">
                  с {fmtDate(s.startDate)}{s.endDate ? ` по ${fmtDate(s.endDate)}` : ''} · горизонт {s.horizonDays} дн.
                </span>
              </div>

              <div className="mt-3 text-sm">
                <div className="mb-1 text-xs text-[var(--text-faint)]">
                  Ближайшие занятия ({s.occurrences.length} в горизонте{booked.length > 0 ? `, с записями: ${booked.length}` : ''})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.occurrences.slice(0, 6).map((o) => (
                    <Badge key={o.id} tone={o._count.bookings > 0 ? 'warning' : 'neutral'}>
                      {fmtDate(o.date)} · {o._count.bookings}/{o.capacity}
                    </Badge>
                  ))}
                  {s.occurrences.length === 0 && <span className="text-xs text-[var(--text-faint)]">нет будущих занятий</span>}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditTarget(s)} disabled={cancelled}>
                  <Pencil size={14} /> Изменить
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onRegenerate(s)} disabled={cancelled || regenerate.isPending}>
                  <RefreshCw size={14} /> Перегенерировать
                </Button>
                <Button size="sm" variant="danger" onClick={() => setCancelTarget(s)} disabled={cancelled}>
                  <Trash2 size={14} /> Отменить серию
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
