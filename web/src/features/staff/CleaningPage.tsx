import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, Plus } from 'lucide-react'
import { useCleaningChecklists, useCreateCleaningChecklist, useToggleCleaningItem } from '../../hooks/useOpsApi'
import { Badge, Button, Card, SectionTitle } from '../../components/ui/Primitives'

const AREA_LABELS: Record<string, string> = {
  FLOOR: 'Пол',
  LIGHTING: 'Освещение',
  SURFACES: 'Поверхности',
  MIRRORS: 'Зеркала',
  RESTROOMS: 'Санузлы',
  LOCKERS: 'Шкафчики',
  WINDOWS: 'Окна',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function CleaningPage() {
  const { data: checklists } = useCleaningChecklists()
  const toggleItem = useToggleCleaningItem()
  const createChecklist = useCreateCleaningChecklist()
  const todayStr = todayIso()
  const [responsible, setResponsible] = useState('')

  const sorted = useMemo(() => [...(checklists ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [checklists])
  const todayChecklist = sorted.find((c) => c.date.slice(0, 10) === todayStr)

  function createToday() {
    if (!responsible.trim()) return
    createChecklist.mutate({ date: todayStr, responsibleName: responsible.trim() }, { onSuccess: () => setResponsible('') })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Уборка</h1>
        <p className="text-sm text-[var(--text-muted)]">Ежедневный чек-лист клининга и ответственные</p>
      </div>

      {todayChecklist ? (
        <Card className="border-2 border-[var(--accent)]">
          <SectionTitle title="Сегодня" subtitle={`${todayChecklist.date.slice(0, 10)} · ответственный: ${todayChecklist.responsibleName}`} action={<Badge tone="accent">Текущий день</Badge>} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {todayChecklist.items.map((it) => (
              <button
                key={it.area}
                onClick={() => toggleItem.mutate({ checklistId: todayChecklist.id, area: it.area })}
                className={`tap-scale flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${it.done ? 'border-green-200 bg-green-50 text-green-700' : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}
              >
                {it.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                {AREA_LABELS[it.area]}
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card>
          <SectionTitle title="Чек-лист на сегодня ещё не создан" />
          <div className="flex flex-wrap gap-2">
            <input
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="ФИО ответственного"
              className="min-w-[220px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button size="sm" onClick={createToday} disabled={!responsible.trim() || createChecklist.isPending}>
              <Plus size={13} /> Создать на {todayStr}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle title="История уборок" />
        <div className="flex flex-col gap-2">
          {sorted.map((c) => {
            const doneCount = c.items.filter((it) => it.done).length
            return (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{c.date.slice(0, 10)}</span>{' '}
                  <span className="text-xs text-[var(--text-faint)]">{c.responsibleName}</span>
                </div>
                <Badge tone={doneCount === c.items.length ? 'success' : doneCount === 0 ? 'danger' : 'warning'}>{doneCount}/{c.items.length} выполнено</Badge>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
