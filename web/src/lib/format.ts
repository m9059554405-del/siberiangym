export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function formatMoney(value: number): string {
  return value.toLocaleString('ru-RU')
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr.length === 10 ? dateStr + 'T00:00:00' : dateStr)
  return d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

export function toDateOnly(iso: string): string {
  return iso.slice(0, 10)
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function trainingDayLabel(dateIso: string): string {
  const [y, m, d] = dateIso.split('-')
  return `Тренировка ${d}.${m}.${y}`
}
