import { useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import { api, ApiError } from '../lib/api'
import { useAuthStore } from '../store/useAuthStore'
import { useCreateGym, useNetworkGyms } from '../hooks/useGymsApi'
import { Button } from './ui/Primitives'
import { Modal } from './ui/Modal'

// Переключатель активной точки сети (P1.1) — виден только CEO. Смена
// точки перевыпускает токен с другим gymId (POST /auth/switch-gym) и
// делает полную перезагрузку страницы: весь кэш react-query и состояние
// компонентов сейчас неявно завязаны на "текущий" gymId из токена, и
// перезагрузка — самый простой надёжный способ не оставить ни одного
// закэшированного запроса от предыдущей точки на экране новой.
export function GymSwitcher() {
  const { data: gyms } = useNetworkGyms()
  const currentGymId = useAuthStore((s) => s.user?.gymId)
  const setSession = useAuthStore((s) => s.setSession)
  const createGym = useCreateGym()

  const [switching, setSwitching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

  async function switchTo(gymId: string) {
    if (gymId === currentGymId || switching) return
    setSwitching(true)
    setError(null)
    try {
      const res = await api.post<{ accessToken: string; user: { id: string; email: string | null; role: string; gymId: string } }>(
        '/auth/switch-gym',
        { gymId },
      )
      setSession(res.accessToken, res.user as never)
      window.location.reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось переключить точку')
      setSwitching(false)
    }
  }

  async function submitCreate() {
    if (!newName.trim()) return
    const gym = await createGym.mutateAsync({ name: newName.trim() })
    setCreateOpen(false)
    setNewName('')
    await switchTo(gym.id)
  }

  if (!gyms || gyms.length === 0) return null

  return (
    <>
      <div className="flex items-center gap-1.5">
        <select
          value={currentGymId ?? ''}
          disabled={switching}
          onChange={(e) => switchTo(e.target.value)}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] px-2.5 py-1.5 text-sm disabled:opacity-50"
          title="Точка сети"
        >
          {gyms.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => setCreateOpen(true)}
          title="Добавить точку сети"
          aria-label="Добавить точку сети"
          className="tap-scale flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
        >
          <Plus size={15} />
        </button>
      </div>
      {error && <span className="text-xs text-red-600">{error}</span>}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новая точка сети">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Building2 size={16} /> Добавляет ещё один зал в вашу сеть — тарифы, товары и расписание для него настраиваются отдельно.
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название точки"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button className="flex-1" onClick={submitCreate} disabled={!newName.trim() || createGym.isPending}>
              <Plus size={14} /> Создать и перейти
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
