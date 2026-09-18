import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useLogWorkout } from '../hooks/useClientApi'
import { RestTimer } from './RestTimer'
import { Button } from './ui/Primitives'
import { Modal } from './ui/Modal'
import type { EffortLevel, Exercise, ProgramDay, WorkoutLogEntry } from '../types'

const EFFORT_ORDER: EffortLevel[] = ['WARMUP', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD']
const EFFORT_COLOR: Record<EffortLevel, string> = {
  WARMUP: '#00FFFF',
  EASY: '#008000',
  MEDIUM: '#EE7700',
  HARD: '#E77471',
  VERY_HARD: '#FF0000',
}
const EFFORT_TEXT_COLOR: Record<EffortLevel, string> = {
  WARMUP: '#083344',
  EASY: '#ffffff',
  MEDIUM: '#ffffff',
  HARD: '#ffffff',
  VERY_HARD: '#ffffff',
}
const EFFORT_LABEL: Record<EffortLevel, string> = {
  WARMUP: 'Разминка',
  EASY: 'Легко',
  MEDIUM: 'Средне',
  HARD: 'Тяжело',
  VERY_HARD: 'Отказ',
}

interface SetRow {
  weight: string
  reps: string
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
  workoutLogs,
}: {
  open: boolean
  onClose: () => void
  day: ProgramDay
  exerciseById: Map<string, Exercise>
  workoutLogs: WorkoutLogEntry[]
}) {
  const logWorkout = useLogWorkout()
  const [rows, setRows] = useState<Record<string, SetRow[]>>({})
  const [effortByExercise, setEffortByExercise] = useState<Record<string, EffortLevel>>({})

  const lastEffortByExercise = useMemo(() => {
    const map = new Map<string, EffortLevel>()
    const sorted = [...workoutLogs].sort((a, b) => a.date.localeCompare(b.date))
    for (const log of sorted) {
      for (const ex of log.exercises) {
        const last = [...ex.sets].reverse().find((s) => s.completed && s.effort)
        if (last?.effort) map.set(ex.exerciseId, last.effort)
      }
    }
    return map
  }, [workoutLogs])

  useEffect(() => {
    if (!open) return
    const map: Record<string, SetRow[]> = {}
    const efforts: Record<string, EffortLevel> = {}
    for (const entry of day.entries) {
      map[entry.exerciseId] = Array.from({ length: entry.sets }, () => ({
        weight: loadToWeight(entry.load),
        reps: entry.reps.split('-')[0] ?? entry.reps,
        completed: true,
      }))
      efforts[entry.exerciseId] = lastEffortByExercise.get(entry.exerciseId) ?? 'MEDIUM'
    }
    setRows(map)
    setEffortByExercise(efforts)
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
      return { ...r, [exerciseId]: [...list, last ? { ...last } : { weight: '', reps: '', completed: true }] }
    })
  }
  function removeSet(exerciseId: string, index: number) {
    setRows((r) => ({ ...r, [exerciseId]: r[exerciseId].filter((_, i) => i !== index) }))
  }
  function selectEffort(exerciseId: string, effort: EffortLevel) {
    setEffortByExercise((prev) => ({ ...prev, [exerciseId]: effort }))
  }

  function finish() {
    const exercises = day.entries.map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: (rows[entry.exerciseId] ?? []).map((s) => ({
        reps: s.reps,
        load: /^\d/.test(s.weight) ? `${s.weight} кг` : s.weight,
        completed: s.completed,
        effort: effortByExercise[entry.exerciseId] ?? 'MEDIUM',
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
          const effort = effortByExercise[entry.exerciseId] ?? 'MEDIUM'
          return (
            <div key={entry.exerciseId} className="rounded-xl border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">{ex.name}</span>
                <span className="text-xs text-[var(--text-faint)]">{ex.muscleGroup}</span>
              </div>
              <div className="flex flex-col gap-1">
                <div className="grid grid-cols-[24px_1fr_1fr_28px] items-center gap-1.5 px-1 text-[10px] text-[var(--text-faint)]">
                  <span>#</span>
                  <span>Вес, кг</span>
                  <span>Повторы</span>
                  <span />
                </div>
                {list.map((set, i) => {
                  const prev = list[i - 1]
                  return (
                    <div key={i} className="grid grid-cols-[24px_1fr_1fr_28px] items-center gap-1.5">
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
              <div className="mt-2 grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)]">
                {EFFORT_ORDER.map((lvl) => {
                  const active = effort === lvl
                  return (
                    <button
                      key={lvl}
                      onClick={() => selectEffort(entry.exerciseId, lvl)}
                      className="flex min-h-[30px] items-center justify-center px-0.5 py-1 text-center text-[10px] font-medium leading-tight"
                      style={{
                        background: active ? EFFORT_COLOR[lvl] : 'var(--surface-raised)',
                        color: active ? EFFORT_TEXT_COLOR[lvl] : 'var(--text-muted)',
                      }}
                    >
                      {EFFORT_LABEL[lvl]}
                    </button>
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

        <Button onClick={finish} disabled={logWorkout.isPending} className="mt-1">
          Завершить тренировку
        </Button>
      </div>
    </Modal>
  )
}
