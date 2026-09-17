import { useMemo, useState } from 'react'
import { ArrowLeftRight, Building2, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTrainers } from '../../hooks/useClientApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { useAssignTrainerGym, useTransactions, useUnassignTrainerGym } from '../../hooks/useCeoApi'
import { useCreateGym, useDeleteGym, useMoveStaff, useNetworkGyms, useNetworkStaff, useUpdateGym } from '../../hooks/useGymsApi'
import { useAuthStore } from '../../store/useAuthStore'
import { AddStaffModal } from './AddStaffModal'
import { Badge, Button, Card, SectionTitle } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { api, ApiError } from '../../lib/api'
import { getInitials } from '../../lib/format'
import { Avatar } from '../../components/ui/Avatar'
import type { Gym, Trainer } from '../../types'

// Панель управления точками сети (заявка клуба): переименование и удаление
// точек, назначение тренеров на одну/несколько/все точки (домашняя точка
// тренера не переносится — только дополнительные, как в P1.3) и
// администраторы сети — создание сразу в выбранную точку и перенос между
// точками. Данные для счётчиков берутся из уже существующих сетевых фидов
// (P1.7), отдельный эндпоинт нужен только для списка STAFF-логинов.

function fmtRub(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

// Модалка создания точки — та же пара полей, что в «+» переключателя
// в шапке, но без автопереключения: страница остаётся на месте.
function CreateGymModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createGym = useCreateGym()
  const [name, setName] = useState('')
  const [minAge, setMinAge] = useState('18')
  const [error, setError] = useState<string | null>(null)

  function close() {
    setName(''); setMinAge('18'); setError(null); onClose()
  }

  function submit() {
    if (!name.trim()) return
    setError(null)
    createGym.mutate(
      { name: name.trim(), selfTrainingMinAge: minAge.trim() ? Number(minAge) : undefined },
      { onSuccess: close, onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось создать точку') },
    )
  }

  return (
    <Modal open={open} onClose={close} title="Новая точка сети">
      <div className="flex flex-col gap-3">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название точки"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-faint)]">Самостоятельные тренировки с возраста (лет)</span>
          <input type="number" min={0} max={100} value={minAge} onChange={(e) => setMinAge(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={close}>Отмена</Button>
          <Button className="flex-1" onClick={submit} disabled={!name.trim() || createGym.isPending}>
            <Plus size={14} /> Создать точку
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function EditGymModal({ gym, onClose }: { gym: Gym | null; onClose: () => void }) {
  const updateGym = useUpdateGym()
  const [name, setName] = useState('')
  const [minAge, setMinAge] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loadedId, setLoadedId] = useState<string | null>(null)

  // Поля инициализируются при каждом новом открытии (gym меняется —
  // перезаливаем форму).
  if (gym && loadedId !== gym.id) {
    setLoadedId(gym.id)
    setName(gym.name)
    setMinAge(String(gym.selfTrainingMinAge))
    setError(null)
  }

  function submit() {
    if (!gym || !name.trim()) return
    setError(null)
    updateGym.mutate(
      {
        gymId: gym.id,
        data: { name: name.trim(), selfTrainingMinAge: minAge.trim() ? Number(minAge) : undefined },
      },
      { onSuccess: onClose, onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось изменить точку') },
    )
  }

  return (
    <Modal open={!!gym} onClose={onClose} title="Изменить точку сети">
      <div className="flex flex-col gap-3">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название точки"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-faint)]">Самостоятельные тренировки с возраста (лет)</span>
          <input type="number" min={0} max={100} value={minAge} onChange={(e) => setMinAge(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
        </label>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={submit} disabled={!name.trim() || updateGym.isPending}>
            <Pencil size={14} /> Сохранить
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteGymModal({ gym, onClose }: { gym: Gym | null; onClose: () => void }) {
  const deleteGym = useDeleteGym()
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!gym) return
    setError(null)
    deleteGym.mutate(gym.id, {
      onSuccess: onClose,
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось удалить точку'),
    })
  }

  return (
    <Modal open={!!gym} onClose={onClose} title="Удалить точку сети">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-[var(--text-muted)]">
          Удалить точку «{gym?.name}»? Это возможно только для пустой точки — без клиентов, тренеров,
          транзакций, склада и администраторов. Тарифы точки будут удалены вместе с ней.
        </p>
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button variant="danger" className="flex-1" onClick={submit} disabled={deleteGym.isPending}>
            <Trash2 size={14} /> Удалить точку
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// Назначение тренера на точки сети (P1.3 + «или во все» из заявки клуба):
// домашняя точка отмечена бейджем и не переключается чекбоксом — перенос
// домашней точки ломал бы карточку тренера, его логины и историю.
function TrainerGymsEditor({ trainer, gyms }: { trainer: Trainer; gyms: Gym[] }) {
  const assign = useAssignTrainerGym(trainer.id)
  const unassign = useUnassignTrainerGym(trainer.id)
  const additionalIds = trainer.additionalGyms?.map((a) => a.gymId) ?? []
  const otherGyms = gyms.filter((g) => g.id !== trainer.gymId)
  const busy = assign.isPending || unassign.isPending
  const homeName = gyms.find((g) => g.id === trainer.gymId)?.name

  function toggle(gymId: string) {
    if (additionalIds.includes(gymId)) unassign.mutate(gymId)
    else assign.mutate(gymId)
  }

  function assignAll() {
    for (const g of otherGyms) {
      if (!additionalIds.includes(g.id)) assign.mutate(g.id)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface-sunken)] p-3">
      <div className="text-xs text-[var(--text-muted)]">
        Домашняя точка: <b>{homeName ?? '—'}</b> (не переносится). Дополнительные точки — чекбоксы.
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {otherGyms.length === 0 && <span className="text-xs text-[var(--text-faint)]">В сети нет других точек</span>}
        {otherGyms.map((g) => (
          <label key={g.id} className="flex cursor-pointer items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={additionalIds.includes(g.id)}
              disabled={busy}
              onChange={() => toggle(g.id)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            {g.name}
          </label>
        ))}
      </div>
      {otherGyms.length > 0 && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={assignAll} disabled={busy}>
            Во все точки
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => additionalIds.forEach((id) => unassign.mutate(id))}
            disabled={busy || additionalIds.length === 0}
          >
            Снять все дополнительные
          </Button>
        </div>
      )}
    </div>
  )
}

export function GymsPage() {
  const { data: gyms } = useNetworkGyms()
  const { data: staff } = useNetworkStaff()
  const { data: clients } = useAllClients(true)
  const { data: trainers } = useTrainers()
  const { data: transactions } = useTransactions()
  const moveStaff = useMoveStaff()
  const currentGymId = useAuthStore((s) => s.user?.gymId)
  const setSession = useAuthStore((s) => s.setSession)

  const [createOpen, setCreateOpen] = useState(false)
  const [editGym, setEditGym] = useState<Gym | null>(null)
  const [deleteGymTarget, setDeleteGymTarget] = useState<Gym | null>(null)
  const [staffOpen, setStaffOpen] = useState(false)
  const [expandedTrainerId, setExpandedTrainerId] = useState<string | null>(null)
  const [switching, setSwitching] = useState(false)

  const stats = useMemo(() => {
    const byGym = new Map<string, { clients: number; trainers: number; staff: number; revenue: number }>()
    const row = (id: string) => byGym.get(id) ?? { clients: 0, trainers: 0, staff: 0, revenue: 0 }
    for (const g of gyms ?? []) byGym.set(g.id, row(g.id))
    for (const c of clients ?? []) {
      if (!c.gymId || !byGym.has(c.gymId)) continue
      const r = row(c.gymId)
      byGym.set(c.gymId, { ...r, clients: r.clients + 1 })
    }
    for (const t of trainers ?? []) {
      const ids = new Set<string>(t.additionalGyms?.map((a) => a.gymId) ?? [])
      if (t.gymId) ids.add(t.gymId)
      for (const id of ids) {
        if (!byGym.has(id)) continue
        const r = row(id)
        byGym.set(id, { ...r, trainers: r.trainers + 1 })
      }
    }
    for (const s of staff ?? []) {
      const r = row(s.gymId)
      byGym.set(s.gymId, { ...r, staff: r.staff + 1 })
    }
    for (const t of transactions ?? []) {
      const r = row(t.gymId)
      byGym.set(t.gymId, { ...r, revenue: r.revenue + t.amount })
    }
    return byGym
  }, [gyms, clients, trainers, staff, transactions])

  async function switchTo(gymId: string) {
    if (gymId === currentGymId || switching) return
    setSwitching(true)
    try {
      const res = await api.post<{ accessToken: string; user: { id: string; email: string | null; role: string; gymId: string } }>(
        '/auth/switch-gym',
        { gymId },
      )
      setSession(res.accessToken, res.user as never)
      window.location.reload()
    } catch {
      setSwitching(false)
    }
  }

  if (!gyms || !staff || !clients || !trainers || !transactions) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Точки сети</h1>
          <p className="text-sm text-[var(--text-muted)]">Создание, переименование и удаление площадок, тренеры и администраторы точек</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Новая точка
        </Button>
      </div>
      <CreateGymModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <EditGymModal gym={editGym} onClose={() => setEditGym(null)} />
      <DeleteGymModal gym={deleteGymTarget} onClose={() => setDeleteGymTarget(null)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {gyms.map((g) => {
          const s = stats.get(g.id) ?? { clients: 0, trainers: 0, staff: 0, revenue: 0 }
          const isActive = g.id === currentGymId
          return (
            <Card key={g.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-[var(--text-faint)]" />
                  <div>
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      Самостоятельно с {g.selfTrainingMinAge} лет
                    </div>
                  </div>
                </div>
                {isActive && <Badge tone="success">Активная</Badge>}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-lg font-bold">{s.clients}</div>
                  <div className="text-xs text-[var(--text-faint)]">клиентов</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{s.trainers}</div>
                  <div className="text-xs text-[var(--text-faint)]">тренеров</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{s.staff}</div>
                  <div className="text-xs text-[var(--text-faint)]">админов</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{fmtRub(s.revenue)}</div>
                  <div className="text-xs text-[var(--text-faint)]">выручка</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!isActive && (
                  <Button size="sm" variant="secondary" onClick={() => switchTo(g.id)} disabled={switching}>
                    <ArrowLeftRight size={14} /> Переключиться
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setEditGym(g)}>
                  <Pencil size={14} /> Изменить
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteGymTarget(g)}>
                  <Trash2 size={14} /> Удалить
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      <Card>
        <SectionTitle
          title="Администраторы сети"
          subtitle="Логины STAFF и их точки — перенос между точками одним выбором"
          action={
            <Button size="sm" onClick={() => setStaffOpen(true)}>
              <Plus size={14} /> Новый администратор
            </Button>
          }
        />
        <div className="flex flex-col gap-2">
          {staff.length === 0 && (
            <p className="text-sm text-[var(--text-faint)]">Администраторов пока нет — создайте первого кнопкой выше.</p>
          )}
          {staff.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 hover:bg-[var(--surface-sunken)]">
              <Avatar initials={getInitials(s.name ?? s.email ?? '?')} hue={(s.id.charCodeAt(0) * 37) % 360} size={30} />
              <div className="min-w-[160px] flex-1">
                <div className="text-sm font-medium">
                  {s.name ?? 'Без имени'} {!s.isActive && <Badge tone="warning">отключён</Badge>}
                </div>
                <div className="text-xs text-[var(--text-faint)]">{s.email}{s.phone ? ` · ${s.phone}` : ''}</div>
              </div>
              <select
                value={s.gymId}
                disabled={moveStaff.isPending}
                onChange={(e) => moveStaff.mutate({ userId: s.id, gymId: e.target.value })}
                aria-label="Точка администратора"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm"
              >
                {gyms.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <AddStaffModal gyms={gyms} open={staffOpen} onClose={() => setStaffOpen(false)} />
      </Card>

      <Card>
        <SectionTitle title="Тренеры на точках" subtitle="Нажмите на тренера, чтобы назначить его на одну, несколько или все точки" />
        <div className="flex flex-col gap-1.5">
          {trainers.map((t) => {
            const expanded = expandedTrainerId === t.id
            const homeName = gyms.find((g) => g.id === t.gymId)?.name
            const additional = (t.additionalGyms ?? []).map((a) => gyms.find((g) => g.id === a.gymId)).filter(Boolean) as Gym[]
            return (
              <div key={t.id} className="rounded-xl">
                <button
                  type="button"
                  onClick={() => setExpandedTrainerId(expanded ? null : t.id)}
                  className="tap-scale flex w-full flex-wrap items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-sunken)]"
                >
                  <Avatar initials={getInitials(t.name)} hue={t.avatarHue} size={30} />
                  <div className="min-w-[140px] flex-1">
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-[var(--text-faint)]">{t.specialization}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {homeName && <Badge tone="neutral">домашняя: {homeName}</Badge>}
                    {additional.map((g) => (
                      <Badge key={g.id} tone="accent">{g.name}</Badge>
                    ))}
                  </div>
                </button>
                {expanded && <div className="px-2 pb-2"><TrainerGymsEditor trainer={t} gyms={gyms} /></div>}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
