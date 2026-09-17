import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useNetworkGyms } from '../../hooks/useGymsApi'
import { useAuthStore } from '../../store/useAuthStore'

// Фильтр CEO-отчётов по точкам сети (P1.7 + заявка клуба на группы
// площадок): «Вся сеть», одна или несколько площадок сразу. Пустой массив
// = вся сеть. Не показывается вне роли CEO и в одноточек сети — там
// фильтровать нечего. Сами данные фиды уже отдают по всей сети, фильтр
// работает мгновенно, на клиенте.

// Дефолт отчётных страниц — активная точка из токена (переключатель в
// шапке): после switch-gym страница перезагружается, и отчёт сразу
// показывает именно выбранную точку, а не «всю сеть», как раньше.
export function defaultGymScope(): string[] {
  const gymId = useAuthStore.getState().user?.gymId
  return gymId ? [gymId] : []
}

export function inGymScope(scope: string[], gymId: string | null | undefined): boolean {
  return scope.length === 0 || (gymId != null && scope.includes(gymId))
}

// Тренер попадает под фильтр, если работает на точке: домашняя ИЛИ
// дополнительная (additionalGyms).
export function trainerInGymScope(scope: string[], t: { gymId?: string; additionalGyms?: { gymId: string }[] }): boolean {
  if (scope.length === 0) return true
  return inGymScope(scope, t.gymId) || (t.additionalGyms?.some((a) => scope.includes(a.gymId)) ?? false)
}

export function NetworkGymFilter({ value, onChange }: { value: string[]; onChange: (gymIds: string[]) => void }) {
  const role = useAuthStore((s) => s.user?.role)
  const { data: gyms } = useNetworkGyms()
  const [open, setOpen] = useState(false)
  if (role !== 'CEO' || !gyms || gyms.length < 2) return null

  const selectedNames = gyms.filter((g) => value.includes(g.id)).map((g) => g.name)
  const label = value.length === 0 ? 'Вся сеть' : value.length === 1 ? (selectedNames[0] ?? 'Точка') : `Площадок: ${value.length}`

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  }

  return (
    <div className="relative">
      {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Точки сети для отчёта"
        className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      >
        {label}
        <ChevronDown size={14} className={`text-[var(--text-faint)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 flex w-60 flex-col gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] p-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onChange([])
              setOpen(false)
            }}
            className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm font-medium hover:bg-[var(--surface-sunken)]"
          >
            Вся сеть
            {value.length === 0 && <Check size={14} className="text-[var(--accent-strong)]" />}
          </button>
          <div className="mx-2 my-0.5 border-t border-[var(--border)]" />
          {gyms.map((g) => (
            <label
              key={g.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-[var(--surface-sunken)]"
            >
              <input
                type="checkbox"
                checked={value.includes(g.id)}
                onChange={() => toggle(g.id)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="flex-1 truncate">{g.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
