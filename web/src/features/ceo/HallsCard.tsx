import { useEffect, useState } from 'react'
import { Dumbbell, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCreateHall, useDeleteHall, useGymHalls, useUpdateHall, type HallPriceInput } from '../../hooks/useGymsApi'
import { Badge, Button, Card } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import { getInitials } from '../../lib/format'
import { Avatar } from '../../components/ui/Avatar'
import type { Gym, Hall, Trainer } from '../../types'

// Залы внутри точки сети (заявка клуба): CEO создаёт тренажёрный зал,
// зал единоборств, тенниса и любой другой, привязывает тренеров точки
// и настраивает цены. Точка без зала существовать не может — последний
// зал удалить нельзя (бэкенд отклонит).

const KIND_PRESETS = ['Тренажерный зал', 'Зал единоборств', 'Зал тенниса']
const CUSTOM_KIND = 'Другой тип…'

function fmtRub(n: number) {
  return n.toLocaleString('ru-RU') + ' ₽'
}

function trainersOfGym(trainers: Trainer[] | undefined, gymId: string) {
  return (trainers ?? []).filter((t) => t.gymId === gymId || t.additionalGyms?.some((a) => a.gymId === gymId))
}

function HallModal({
  gym,
  hall,
  trainers,
  onClose,
}: {
  gym: Gym
  hall: Hall | null
  trainers: Trainer[]
  onClose: () => void
}) {
  const create = useCreateHall()
  const update = useUpdateHall()
  const [name, setName] = useState('')
  const [kind, setKind] = useState(KIND_PRESETS[0])
  const [customKind, setCustomKind] = useState('')
  const [trainerIds, setTrainerIds] = useState<string[]>([])
  const [prices, setPrices] = useState<HallPriceInput[]>([])
  const [error, setError] = useState<string | null>(null)
  const editing = !!hall
  const pending = create.isPending || update.isPending

  // Форма перезаливается при каждом новом открытии.
  useEffect(() => {
    if (!hall && gym) {
      setName(''); setKind(KIND_PRESETS[0]); setCustomKind(''); setTrainerIds([]); setPrices([]); setError(null)
      return
    }
    if (hall) {
      setName(hall.name)
      const preset = KIND_PRESETS.includes(hall.kind)
      setKind(preset ? hall.kind : CUSTOM_KIND)
      setCustomKind(preset ? '' : hall.kind)
      setTrainerIds(hall.trainers.map((t) => t.trainerId))
      setPrices(hall.prices.map((p) => ({ label: p.label, amount: p.amount })))
      setError(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hall?.id, gym.id, hall === null])

  const effectiveKind = kind === CUSTOM_KIND ? customKind.trim() : kind

  function toggleTrainer(id: string) {
    setTrainerIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }

  function submit() {
    if (!name.trim() || !effectiveKind) return
    setError(null)
    const data = {
      name: name.trim(),
      kind: effectiveKind,
      trainerIds,
      prices: prices.filter((p) => p.label.trim()),
    }
    if (editing && hall) {
      update.mutate(
        { hallId: hall.id, gymId: gym.id, data },
        { onSuccess: onClose, onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось изменить зал') },
      )
    } else {
      create.mutate(
        { gymId: gym.id, data },
        { onSuccess: onClose, onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось создать зал') },
      )
    }
  }

  const inputCls = 'rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'

  return (
    <Modal open onClose={onClose} title={editing ? `Изменить зал — ${gym.name}` : `Новый зал — ${gym.name}`}>
      <div className="flex flex-col gap-3">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-faint)]">Тип зала</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
            {KIND_PRESETS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
            <option value={CUSTOM_KIND}>{CUSTOM_KIND}</option>
          </select>
        </label>
        {kind === CUSTOM_KIND && (
          <input value={customKind} onChange={(e) => setCustomKind(e.target.value)} placeholder="Свой тип зала (например, зал гимнастики)" className={inputCls} />
        )}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--text-faint)]">Название</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={effectiveKind || 'Название зала'}
            className={inputCls}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-faint)]">Тренеры зала (работают на этой точке)</span>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-xl bg-[var(--surface-sunken)] p-2">
            {trainers.length === 0 && <span className="px-1 text-xs text-[var(--text-faint)]">На этой точке пока нет тренеров</span>}
            {trainers.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 px-1 text-sm">
                <input
                  type="checkbox"
                  checked={trainerIds.includes(t.id)}
                  onChange={() => toggleTrainer(t.id)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
                <Avatar initials={getInitials(t.name)} hue={t.avatarHue} size={22} />
                {t.name}
                <span className="text-xs text-[var(--text-faint)]">{t.specialization}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--text-faint)]">Цены зала (любые позиции, рубли)</span>
          <div className="flex flex-col gap-1.5">
            {prices.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={p.label}
                  onChange={(e) => setPrices((rows) => rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                  placeholder="Например: Час аренды"
                  className={`${inputCls} flex-1`}
                />
                <input
                  type="number"
                  min={0}
                  value={p.amount || ''}
                  onChange={(e) => setPrices((rows) => rows.map((r, j) => (j === i ? { ...r, amount: Number(e.target.value) || 0 } : r)))}
                  placeholder="₽"
                  className={`${inputCls} w-24`}
                />
                <button
                  type="button"
                  onClick={() => setPrices((rows) => rows.filter((_, j) => j !== i))}
                  className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
                  title="Убрать цену"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setPrices((rows) => [...rows, { label: '', amount: 0 }])}>
              <Plus size={14} /> Добавить цену
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Отмена</Button>
          <Button className="flex-1" onClick={submit} disabled={pending || !name.trim() || !effectiveKind}>
            {editing ? <Pencil size={14} /> : <Plus size={14} />} {editing ? 'Сохранить' : 'Создать зал'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function HallsCard({ gym, trainers }: { gym: Gym; trainers: Trainer[] | undefined }) {
  const { data: halls } = useGymHalls(gym.id)
  const deleteHall = useDeleteHall()
  const [modalOpen, setModalOpen] = useState(false)
  const [editHall, setEditHall] = useState<Hall | null>(null)
  const [error, setError] = useState<string | null>(null)
  const gymTrainers = trainersOfGym(trainers, gym.id)
  const list = halls ?? []

  function openCreate() {
    setEditHall(null)
    setError(null)
    setModalOpen(true)
  }

  function openEdit(hall: Hall) {
    setEditHall(hall)
    setError(null)
    setModalOpen(true)
  }

  function remove(hall: Hall) {
    setError(null)
    deleteHall.mutate(
      { hallId: hall.id, gymId: gym.id },
      { onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось удалить зал') },
    )
  }

  return (
    <Card className="mt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <Dumbbell size={16} className="text-[var(--text-faint)]" />
          Залы точки
        </div>
        <Button size="sm" variant="secondary" onClick={openCreate}>
          <Plus size={14} /> Добавить зал
        </Button>
      </div>
      {error && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="flex flex-col gap-2">
        {list.length === 0 && <p className="text-sm text-[var(--text-faint)]">Загрузка залов…</p>}
        {list.map((hall) => (
          <div key={hall.id} className="rounded-xl bg-[var(--surface-sunken)] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-sm font-medium">
                  {hall.name} <Badge tone="accent">{hall.kind}</Badge>
                </div>
                {hall.trainers.length > 0 && (
                  <div className="mt-1 text-xs text-[var(--text-muted)]">
                    Тренеры: {hall.trainers.map((t) => t.trainer.name).join(', ')}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => openEdit(hall)}>
                  <Pencil size={13} /> Изменить
                </Button>
                <Button size="sm" variant="danger" disabled={deleteHall.isPending} onClick={() => remove(hall)} title="Последний зал точки удалить нельзя">
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
            {hall.prices.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hall.prices.map((p) => (
                  <Badge key={p.id} tone="neutral">{p.label}: {fmtRub(p.amount)}</Badge>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {modalOpen && (
        <HallModal gym={gym} hall={editHall} trainers={gymTrainers} onClose={() => setModalOpen(false)} />
      )}
    </Card>
  )
}
