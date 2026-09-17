import { useNetworkGyms } from '../../hooks/useGymsApi'
import { useAuthStore } from '../../store/useAuthStore'

// Фильтр CEO-отчётов по точкам сети (P1.7): «Вся сеть» или конкретная
// площадка. Не показывается вне роли CEO и в однокточечной сети — там
// фильтровать нечего. Сами данные фиды уже отдают по всей сети, фильтр
// работает мгновенно, на клиенте.
export function NetworkGymFilter({ value, onChange }: { value: string; onChange: (gymId: string) => void }) {
  const role = useAuthStore((s) => s.user?.role)
  const { data: gyms } = useNetworkGyms()
  if (role !== 'CEO' || !gyms || gyms.length < 2) return null
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Точка сети"
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
    >
      <option value="">Вся сеть</option>
      {gyms.map((g) => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  )
}
