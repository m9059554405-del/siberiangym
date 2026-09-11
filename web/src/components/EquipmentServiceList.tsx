import { useMemo, useState } from 'react'
import { AlertTriangle, Wrench } from 'lucide-react'
import { useCompleteEquipmentService, useEquipment, type EquipmentItem } from '../hooks/useOpsApi'
import { Badge, Button, Card, SectionTitle, StatTile } from './ui/Primitives'
import { Modal } from './ui/Modal'

const CATEGORY_LABELS: Record<string, string> = {
  LIGHTING: 'Освещение',
  RESTROOMS: 'Санузлы',
  LOCKERS: 'Шкафчики',
  AC: 'Кондиционеры / вентиляция',
  FRIDGES: 'Холодильники',
  GYM_EQUIPMENT: 'Тренажёры',
}
const CATEGORY_ORDER = ['GYM_EQUIPMENT', 'AC', 'LIGHTING', 'RESTROOMS', 'FRIDGES', 'LOCKERS']

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function daysUntil(dateStr: string, todayStr: string): number {
  return Math.round((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000)
}

export function EquipmentServiceList() {
  const { data: equipment } = useEquipment()
  const completeService = useCompleteEquipmentService()
  const todayStr = todayIso()

  const equipmentByCategory = useMemo(() => {
    const map = new Map<string, EquipmentItem[]>()
    for (const cat of CATEGORY_ORDER) map.set(cat, [])
    for (const eq of equipment ?? []) map.get(eq.category)?.push(eq)
    return map
  }, [equipment])

  const responsibleOptions = useMemo(() => [...new Set((equipment ?? []).map((e) => e.responsibleName))].sort(), [equipment])

  const overdueCount = (equipment ?? []).filter((e) => daysUntil(e.nextServiceDate.slice(0, 10), todayStr) < 0).length
  const soonCount = (equipment ?? []).filter((e) => { const d = daysUntil(e.nextServiceDate.slice(0, 10), todayStr); return d >= 0 && d <= 14 }).length
  const expiredWarranty = (equipment ?? []).filter((e) => e.warrantyUntil && daysUntil(e.warrantyUntil.slice(0, 10), todayStr) < 0).length

  const [serviceEq, setServiceEq] = useState<EquipmentItem | null>(null)
  const [serviceDate, setServiceDate] = useState(todayStr)
  const [responsible, setResponsible] = useState('')

  function openService(eq: EquipmentItem) {
    setServiceEq(eq)
    setServiceDate(todayStr)
    setResponsible(eq.responsibleName)
  }
  function submitService() {
    if (!serviceEq || !responsible.trim()) return
    completeService.mutate({ id: serviceEq.id, responsibleName: responsible.trim(), serviceDate }, { onSuccess: () => setServiceEq(null) })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Всего единиц" value={(equipment ?? []).length} />
        <StatTile label="Просрочено обслуживание" value={overdueCount} hint={overdueCount > 0 ? 'требует внимания' : undefined} />
        <StatTile label="Скоро (≤14 дн.)" value={soonCount} />
        <StatTile label="Гарантия истекла" value={expiredWarranty} />
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const items = equipmentByCategory.get(cat) ?? []
        if (items.length === 0) return null
        return (
          <Card key={cat}>
            <SectionTitle title={CATEGORY_LABELS[cat]} subtitle={`${items.length} ед.`} />
            <div className="flex flex-col gap-2">
              {items.map((eq) => {
                const dLeft = daysUntil(eq.nextServiceDate.slice(0, 10), todayStr)
                const overdue = dLeft < 0
                const soon = dLeft >= 0 && dLeft <= 14
                const warrantyDays = eq.warrantyUntil ? daysUntil(eq.warrantyUntil.slice(0, 10), todayStr) : null
                return (
                  <div key={eq.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
                    <div className="min-w-[160px]">
                      <div className="text-sm font-medium">{eq.name}</div>
                      <div className="text-xs text-[var(--text-faint)]">{eq.zone} · отв.: {eq.responsibleName}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge tone={overdue ? 'danger' : soon ? 'warning' : 'success'}>
                        {overdue ? `просрочено на ${Math.abs(dLeft)} дн.` : `след. ТО: ${eq.nextServiceDate.slice(0, 10)}`}
                      </Badge>
                      <Badge tone={warrantyDays === null ? 'neutral' : warrantyDays < 0 ? 'danger' : 'accent'}>
                        {warrantyDays === null ? 'без гарантии' : warrantyDays < 0 ? `гарантия истекла ${eq.warrantyUntil?.slice(0, 10)}` : `гарантия до ${eq.warrantyUntil?.slice(0, 10)}`}
                      </Badge>
                      <Button size="sm" variant="secondary" onClick={() => openService(eq)}>
                        <Wrench size={13} /> Отметить ТО
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}

      {overdueCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-faint)]">
          <AlertTriangle size={13} /> Позиции с просроченным ТО отмечены красным — запланируйте визит техника.
        </div>
      )}

      <Modal open={!!serviceEq} onClose={() => setServiceEq(null)} title={serviceEq ? `ТО: ${serviceEq.name}` : 'ТО'}>
        {serviceEq && (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Дата обслуживания</span>
              <input type="date" value={serviceDate} onChange={(e) => setServiceDate(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--text-muted)]">Ответственный</span>
              <input
                list="equipment-responsible-options"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="ФИО ответственного"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <datalist id="equipment-responsible-options">
                {responsibleOptions.map((name) => <option key={name} value={name} />)}
              </datalist>
            </label>
            <p className="text-xs text-[var(--text-faint)]">
              Следующее ТО будет назначено через {serviceEq.intervalDays} дн.
            </p>
            <Button onClick={submitService} disabled={!responsible.trim() || completeService.isPending}>
              <Wrench size={14} /> Отметить ТО выполненным
            </Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
