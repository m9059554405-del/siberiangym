import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]
const DAY_MS = 86400000

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function mondayOf(d: Date): Date {
  const wd = d.getDay() === 0 ? 6 : d.getDay() - 1
  return new Date(d.getTime() - wd * DAY_MS)
}

interface MonthCalendarGridProps {
  monthAnchor: Date
  markers?: Record<string, number>
  selectedDate?: string | null
  todayStr: string
  onSelectDate: (dateStr: string) => void
  onMonthChange: (anchor: Date) => void
}

export function MonthCalendarGrid({ monthAnchor, markers = {}, selectedDate, todayStr, onSelectDate, onMonthChange }: MonthCalendarGridProps) {
  const year = monthAnchor.getFullYear()
  const month = monthAnchor.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = mondayOf(firstOfMonth)
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY_MS))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onMonthChange(new Date(year, month - 1, 1))}
          className="tap-scale rounded-lg border border-[var(--border)] p-1.5"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold">{MONTH_NAMES[month]} {year}</span>
        <button
          onClick={() => onMonthChange(new Date(year, month + 1, 1))}
          className="tap-scale rounded-lg border border-[var(--border)] p-1.5"
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[var(--text-faint)]">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const dateStr = isoDate(d)
          const inMonth = d.getMonth() === month
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const count = markers[dateStr] ?? 0
          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              className={`tap-scale relative flex aspect-square flex-col items-center justify-center rounded-lg text-xs ${
                isSelected
                  ? 'text-white'
                  : inMonth
                    ? 'text-[var(--text)] hover:bg-[var(--surface-sunken)]'
                    : 'text-[var(--text-faint)]/50'
              }`}
              style={{
                background: isSelected ? 'var(--accent-gradient)' : 'transparent',
                outline: isToday && !isSelected ? '1.5px solid var(--accent)' : undefined,
              }}
            >
              {d.getDate()}
              {count > 0 && (
                <span
                  className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full"
                  style={{ background: isSelected ? '#ffffff' : 'var(--accent)' }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
