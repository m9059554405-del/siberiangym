import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useCreateEquipment } from '../../hooks/useOpsApi'
import { EquipmentServiceList } from '../../components/EquipmentServiceList'
import { Button } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'

const CATEGORY_OPTIONS = [
  { value: 'GYM_EQUIPMENT', label: 'Тренажёры' },
  { value: 'AC', label: 'Кондиционеры / вентиляция' },
  { value: 'LIGHTING', label: 'Освещение' },
  { value: 'RESTROOMS', label: 'Санузлы' },
  { value: 'FRIDGES', label: 'Холодильники' },
  { value: 'LOCKERS', label: 'Шкафчики' },
]

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function EquipmentPage() {
  const createEquipment = useCreateEquipment()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('GYM_EQUIPMENT')
  const [zone, setZone] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [intervalDays, setIntervalDays] = useState(90)
  const [warrantyUntil, setWarrantyUntil] = useState('')

  function submit() {
    if (!name.trim() || !zone.trim() || !responsibleName.trim()) return
    createEquipment.mutate(
      { name: name.trim(), category, zone: zone.trim(), responsibleName: responsibleName.trim(), lastServiceDate: todayIso(), intervalDays, warrantyUntil: warrantyUntil || undefined },
      { onSuccess: () => { setName(''); setZone(''); setResponsibleName(''); setIntervalDays(90); setWarrantyUntil(''); setOpen(false) } },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">ППР — плановое обслуживание</h1>
          <p className="text-sm text-[var(--text-muted)]">График обслуживания оборудования и сроки гарантии</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Добавить оборудование
        </Button>
      </div>
      <EquipmentServiceList />

      <Modal open={open} onClose={() => setOpen(false)} title="Новое оборудование">
        <div className="flex flex-col gap-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input value={zone} onChange={(e) => setZone(e.target.value)} placeholder="Зона (напр. Зал 1)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <input value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} placeholder="Ответственный"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Интервал ТО, дней</span>
            <input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(Number(e.target.value))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Гарантия до (необязательно)</span>
            <input type="date" value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
          </label>
          <Button onClick={submit} disabled={!name.trim() || !zone.trim() || !responsibleName.trim() || createEquipment.isPending}>
            <Plus size={14} /> Добавить
          </Button>
        </div>
      </Modal>
    </div>
  )
}
