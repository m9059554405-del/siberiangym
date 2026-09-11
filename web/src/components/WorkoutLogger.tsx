import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useLogWorkout } from '../hooks/useClientApi'
import { RestTimer } from './RestTimer'
import { Button } from './ui/Primitives'
import { Modal } from './ui/Modal'
import type { EffortLevel, Exercise, ProgramDay } from '../types'

const EFFORT_ORDER: EffortLevel[] = ['WARMUP', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD']
const EFFORT_COLOR: Record<EffortLevel, string> = {
  WARMUP: '#9ca3af',
  EASY: '#22c55e',
  MEDIUM: '#eab308',
  HARD: '#f97316',
  VERY_HARD: '#ef4444',
}
const EFFORT_LABEL: Record<EffortLevel, string> = {
  WARMUP: 'Разминка',
  EASY: 'Легко',
  MEDIUM: 'Средне',
  HARD: 'Тяжело',
  VERY_HARD: 'Очень тяжело',
}

interface SetRow {
  weight: string
  reps: string
  effort: EffortLevel
  completed: boolean
}

function parseNum(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function deltaLabel(curr: string, prev: string | undefined): string | null {
  if (prev === undefined) return null
  const c = parseNum(curr)
  const p = parseNum(prev)
  if (c === null || p === null) return null
  const diff = c - p
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff % 1 === 0 ? diff : diff.toFixed(2)}`
}

function loadToWeight(load: string): string {
  const m = /^(\d+(?:\.\d+)?)/.exec(load)
  return m ? m[1] : load
}

export function WorkoutLogger({
  open,
  onClose,
  day,
  exerciseById,
}: {
  open: boolean
  onClose: () => void
  day: ProgramDay
  exerciseById: Map<string, Exercise>
}) {
  const logWorkout = useLogWorkout()
  const [rows, setRows] = useState<Record<string, SetRow[]>>({})

  useEffect(() => {
    if (!open) return
    const map: Record<string, SetRow[]> = {}
    for (const entry of day.entries) {
      map[entry.exerciseId] = Array.from({ length: entry.sets }, () => ({
        weight: loadToWeight(entry.load),
        reps: entry.reps.split('-')[0] ?? entry.reps,
        effort: 'MEDIUM' as EffortLevel,
        completed: true,
      }))
    }
    setRows(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, day])

  function updateSet(exerciseId: string, index: number, patch: Partial<SetRow>) {
    setRows((r) => ({
      ...r,
      [exerciseId]: r[exerciseId].map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }))
  }
  function addSet(exerciseId: string) {
    setRows((r) => {
      const list = r[exerciseId]
      const last = list[list.length - 1]
      return { ...r, [exerciseId]: [...list, last ? { ...last } : { weight: '', reps: '', effort: 'MEDIUM', completed: true }] }
    })
  }
  function removeSet(exerciseId: string, index: number) {
    setRows((r) => ({ ...r, [exerciseId]: r[exerciseId].filter((_, i) => i !== index) }))
  }
  function cycleEffort(exerciseId: string, index: number) {
    const current = rows[exerciseId][index].effort
    const next = EFFORT_ORDER[(EFFORT_ORDER.indexOf(current) + 1) % EFFORT_ORDER.length]
    updateSet(exerciseId, index, { effort: next })
  }

  function finish() {
    const exercises = day.entries.map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: (rows[entry.exerciseId] ?? []).map((s) => ({
        reps: s.reps,
        load: /^\d/.test(s.weight) ? `${s.weight} кг` : s.weight,
        completed: s.completed,
        effort: s.effort,
      })),
    }))
    logWorkout.mutate({ dayLabel: day.label, exercises }, { onSuccess: onClose })
  }

  return (
    <Modal open={open} onClose={onClose} title={day.label}>
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto">
        {day.entries.map((entry) => {
          const ex = exerciseById.get(entry.exerciseId)
          if (!ex) return null
          const list = rows[entry.exerciseId] ?? []
          return (
            <div key={entry.exerciseId} className="rounded-xl border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{ex.name}</span>
                <span className="text-xs text-[var(--text-faint)]">{ex.muscleGroup}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-[16px_24px_1fr_1fr_28px] items-center gap-1.5 px-1 text-[10px] text-[var(--text-faint)]">
                  <span />
                  <span>#</span>
                  <span>Вес, кг</span>
                  <span>Повторы</span>
                  <span />
                </div>
                {list.map((set, i) => {
                  const prev = list[i - 1]
                  return (
                    <div key={i} className="grid grid-cols-[16px_24px_1fr_1fr_28px] items-center gap-1.5">
                      <button
                        title={EFFORT_LABEL[set.effort]}
                        onClick={() => cycleEffort(entry.exerciseId, i)}
                        className="h-6 w-2 rounded-full"
                        style={{ background: EFFORT_COLOR[set.effort] }}
                      />
                      <span className="text-center text-xs font-medium text-[var(--text-faint)]">{i + 1}</span>
                      <div className="flex flex-col">
                        <input
                          value={set.weight}
                          onChange={(e) => updateSet(entry.exerciseId, i, { weight: e.target.value })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
                        />
                        {prev && deltaLabel(set.weight, prev.weight) && (
                          <span className="pl-1 text-[10px] text-[var(--text-faint)]">{deltaLabel(set.weight, prev.weight)}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <input
                          value={set.reps}
                          onChange={(e) => updateSet(entry.exerciseId, i, { reps: e.target.value })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
                        />
                        {prev && deltaLabel(set.reps, prev.reps) && (
                          <span className="pl-1 text-[10px] text-[var(--text-faint)]">{deltaLabel(set.reps, prev.reps)}</span>
                        )}
                      </div>
                      <button onClick={() => removeSet(entry.exerciseId, i)} className="text-[var(--text-faint)] hover:text-red-500">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => addSet(entry.exerciseId)}
                className="tap-scale mt-2 flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]"
              >
                <Plus size={13} /> Подход
              </button>
              <div className="mt-2">
                <RestTimer defaultSeconds={180} />
              </div>
            </div>
          )
        })}

        <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--text-faint)]">
          <span>Нажмите на цветной индикатор, чтобы задать состояние:</span>
          {EFFORT_ORDER.map((lvl) => (
            <span key={lvl} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: EFFORT_COLOR[lvl] }} />
              {EFFORT_LABEL[lvl]}
            </span>
          ))}
        </div>

        <Button onClick={finish} disabled={logWorkout.isPending} className="mt-1">
          Завершить тренировку
        </Button>
      </div>
    </Modal>
  )
}
