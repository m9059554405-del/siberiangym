import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react'
import { useGroupClasses, usePersonalSlots } from '../../hooks/useClientApi'
import { useMyTrainerProfile } from '../../hooks/useTrainerApi'
import { MonthCalendarGrid } from '../../components/MonthCalendarGrid'
import { Badge, Card, SectionTitle } from '../../components/ui/Primitives'

const WEEKDAY_LABELS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const DAY_MS = 86400000

function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function mondayOf(d: Date) {
  const wd = d.getDay() === 0 ? 6 : d.getDay() - 1
  return new Date(d.getTime() - wd * DAY_MS)
}

export function TrainerSchedulePage() {
  const { data: trainer } = useMyTrainerProfile()
  const { data: groupClasses } = useGroupClasses()
  const { data: personalSlots } = usePersonalSlots()
  const [weekOffset, setWeekOffset] = useState(0)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [monthAnchor, setMonthAnchor] = useState(() => new Date())
  const todayStr = isoDate(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(todayStr)

  const weekStart = useMemo(() => mondayOf(new Date(Date.now() + weekOffset * 7 * DAY_MS)), [weekOffset])
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(new Date(weekStart.getTime() + i * DAY_MS))), [weekStart])

  const monthMarkers = useMemo(() => {
    const m: Record<string, number> = {}
    if (!trainer) return m
    for (const gc of groupClasses ?? []) if (gc.trainerId === trainer.id) m[gc.date.slice(0, 10)] = (m[gc.date.slice(0, 10)] ?? 0) + 1
    for (const s of personalSlots ?? []) if (s.trainerId === trainer.id && s.status !== 'FREE') m[s.date.slice(0, 10)] = (m[s.date.slice(0, 10)] ?? 0) + 1
    return m
  }, [groupClasses, personalSlots, trainer])

  if (!trainer) return null

  function dayItemsFor(date: string) {
    const classes = (groupClasses ?? []).filter((gc) => gc.trainerId === trainer!.id && gc.date.slice(0, 10) === date)
    const slots = (personalSlots ?? []).filter((s) => s.trainerId === trainer!.id && s.date.slice(0, 10) === date && s.status !== 'FREE')
    return { date, classes, slots, total: classes.length + slots.length }
  }

  const dayItems = weekDates.map(dayItemsFor)
  const maxTotal = Math.max(1, ...dayItems.map((d) => d.total))

  const selectedDayItems = dayItemsFor(selectedDate)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Моё расписание</h1>
          <p className="text-sm text-[var(--text-muted)]">{trainer.name} · {trainer.specialization}</p>
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-[var(--surface-sunken)] p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`tap-scale flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${viewMode === 'list' ? 'bg-[var(--surface-raised)] shadow-sm' : 'text-[var(--text-muted)]'}`}
          >
            <List size={14} />
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`tap-scale flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium ${viewMode === 'calendar' ? 'bg-[var(--surface-raised)] shadow-sm' : 'text-[var(--text-muted)]'}`}
          >
            <CalendarDays size={14} />
          </button>
        </div>
      </div>

      {viewMode === 'list' && (
        <>
          <div className="flex items-center justify-between">
            <button onClick={() => setWeekOffset((w) => w - 1)} className="tap-scale rounded-lg border border-[var(--border)] p-1.5">
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-medium">
              {weekDates[0]} — {weekDates[6]} {weekOffset === 0 && <Badge tone="accent">Текущая неделя</Badge>}
            </span>
            <button onClick={() => setWeekOffset((w) => w + 1)} className="tap-scale rounded-lg border border-[var(--border)] p-1.5">
              <ChevronRight size={16} />
            </button>
          </div>

          <Card>
            <SectionTitle title="Нагрузка по дням" />
            <div className="flex items-end gap-2" style={{ height: 80 }}>
              {dayItems.map((d, i) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full rounded-t-md bg-[var(--accent)]" style={{ height: `${(d.total / maxTotal) * 60}px`, minHeight: d.total > 0 ? 6 : 0 }} />
                  <span className="text-[10px] text-[var(--text-faint)]">{WEEKDAY_LABELS[i].slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </Card>

          <div className="flex flex-col gap-3">
            {dayItems.map((d, i) => (
              <Card key={d.date}>
                <h3 className="mb-2 text-sm font-semibold">{WEEKDAY_LABELS[i]} · {d.date}</h3>
                {d.total === 0 && <p className="text-xs text-[var(--text-faint)]">Нет занятий</p>}
                <div className="flex flex-col gap-1.5">
                  {d.classes.map((gc) => (
                    <div key={gc.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-1.5 text-sm">
                      <span>{gc.start}–{gc.end} · <span className="font-medium">{gc.type}</span> · {gc.zone}</span>
                      <Badge tone="accent">{gc.bookings.length}/{gc.capacity} мест</Badge>
                    </div>
                  ))}
                  {d.slots.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-1.5 text-sm">
                      <span>{s.start}–{s.end} · персонально · {s.client?.name ?? '—'}</span>
                      <Badge tone={s.status === 'PAST_MISSED' ? 'danger' : s.status === 'BOOKED' ? 'accent' : 'success'}>
                        {s.status === 'BOOKED' ? 'Забронировано' : s.status === 'PAST_COMPLETED' ? 'Проведено' : 'Пропущено'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {viewMode === 'calendar' && (
        <>
          <Card>
            <MonthCalendarGrid monthAnchor={monthAnchor} markers={monthMarkers} selectedDate={selectedDate} todayStr={todayStr} onSelectDate={setSelectedDate} onMonthChange={setMonthAnchor} />
          </Card>
          <Card>
            <h3 className="mb-2 text-sm font-semibold">{selectedDate}</h3>
            {selectedDayItems.total === 0 && <p className="text-xs text-[var(--text-faint)]">Нет занятий</p>}
            <div className="flex flex-col gap-1.5">
              {selectedDayItems.classes.map((gc) => (
                <div key={gc.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-1.5 text-sm">
                  <span>{gc.start}–{gc.end} · <span className="font-medium">{gc.type}</span> · {gc.zone}</span>
                  <Badge tone="accent">{gc.bookings.length}/{gc.capacity} мест</Badge>
                </div>
              ))}
              {selectedDayItems.slots.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-1.5 text-sm">
                  <span>{s.start}–{s.end} · персонально · {s.client?.name ?? '—'}</span>
                  <Badge tone={s.status === 'PAST_MISSED' ? 'danger' : s.status === 'BOOKED' ? 'accent' : 'success'}>
                    {s.status === 'BOOKED' ? 'Забронировано' : s.status === 'PAST_COMPLETED' ? 'Проведено' : 'Пропущено'}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
