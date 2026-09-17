import { useState } from 'react'
import { ShieldPlus } from 'lucide-react'
import { useCreateStaff } from '../../hooks/useCeoApi'
import { useAuthStore } from '../../store/useAuthStore'
import { Badge, Button } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import type { Gym } from '../../types'

// Инструмент CEO «Завести администратора» (P1.10) — в отличие от тренера,
// у STAFF нет отдельной карточки-сущности, поэтому это один шаг, а не два.
// gyms (страница «Точки сети») — выбрать точку сети для администратора;
// без пропа заводится в активную точку токена, как раньше.
export function AddStaffModal({ open, onClose, gyms }: { open: boolean; onClose: () => void; gyms?: Gym[] }) {
  const createStaff = useCreateStaff()
  const currentGymId = useAuthStore((s) => s.user?.gymId)
  const [gymId, setGymId] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function reset() {
    setGymId(''); setName(''); setEmail(''); setPhone(''); setPassword(''); setError(null); setDone(false)
  }

  function submit() {
    if (!name.trim() || !email.trim() || password.length < 8) return
    setError(null)
    createStaff.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        gymId: gymId || undefined,
      },
      { onSuccess: () => setDone(true), onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось создать администратора') },
    )
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Новый администратор">
      {done ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Badge tone="success">Администратор создан ✓</Badge>
          <p className="text-sm text-[var(--text-muted)]">Логин и пароль можно передать сотруднику — доступ уже активен.</p>
          <Button variant="secondary" onClick={() => { reset(); onClose() }}>Готово</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          {gyms && gyms.length > 1 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-faint)]">Точка сети</span>
              <select
                value={gymId || currentGymId || ''}
                onChange={(e) => setGymId(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm"
              >
                {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email для входа"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон (необязательно)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Временный пароль (мин. 8 символов)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { reset(); onClose() }}>Отмена</Button>
            <Button className="flex-1" onClick={submit} disabled={!name.trim() || !email.trim() || password.length < 8 || createStaff.isPending}>
              <ShieldPlus size={14} /> Создать администратора
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
