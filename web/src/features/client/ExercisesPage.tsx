import { useMemo, useState } from 'react'
import { CheckCircle2, MinusCircle, PlusCircle, XCircle } from 'lucide-react'
import { useExercises, useMe, useOwnWorkoutLogs, useProgram, useSaveOwnProgram } from '../../hooks/useClientApi'
import { Badge, Button, Card, EmptyState, Tabs } from '../../components/ui/Primitives'
import { todayIso, trainingDayLabel } from '../../lib/format'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABEL } from '../../data/exercises'
import { getExerciseImages } from '../../data/exerciseImages'
import { WorkoutLogger } from '../../components/WorkoutLogger'
import type { MuscleGroup, ProgramDay } from '../../types'

const STATUS_INFO: Record<string, { label: string; tone: 'success' | 'warning' | 'danger'; icon: typeof CheckCircle2 }> = {
  COMPLETED: { label: 'Выполнено', tone: 'success', icon: CheckCircle2 },
  PARTIAL: { label: 'Частично', tone: 'warning', icon: MinusCircle },
  MISSED: { label: 'Пропущено', tone: 'danger', icon: XCircle },
}

export function ExercisesPage() {
  const { data: client } = useMe()
  const { data: exercises } = useExercises()
  const { data: program } = useProgram(client?.id)
  const { data: workoutLogs } = useOwnWorkoutLogs()
  const saveProgram = useSaveOwnProgram(client?.id)

  const [tab, setTab] = useState<'program' | 'library' | 'history'>('program')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all')
  const [pickerDayIndex, setPickerDayIndex] = useState<number | null>(null)
  const [loggingDay, setLoggingDay] = useState<ProgramDay | null>(null)
  const [trainingDate, setTrainingDate] = useState<string | null>(null)

  const exerciseById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const isSelf = client?.format === 'SELF'

  const myLogs = useMemo(() => [...(workoutLogs ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [workoutLogs])
  const completedLabels = useMemo(() => new Set(myLogs.filter((l) => l.status === 'COMPLETED').map((l) => l.dayLabel)), [myLogs])

  if (!client || !exercises) return null

  const days = program?.days ?? []
  const visibleDays = days.map((day, dayIndex) => ({ day, dayIndex })).filter(({ day }) => !completedLabels.has(day.label))
  const completedLogs = myLogs.filter((l) => l.status === 'COMPLETED')

  function saveDays(nextDays: { label: string; order: number; entries: { exerciseId: string; sets: number; reps: string; load: string; order: number }[] }[]) {
    saveProgram.mutate(nextDays)
  }

  function toPayload(list: ProgramDay[]) {
    return list.map((d, i) => ({
      label: d.label,
      order: i,
      entries: d.entries.map((e, ei) => ({ exerciseId: e.exerciseId, sets: e.sets, reps: e.reps, load: e.load, order: ei })),
    }))
  }

  function addExercise(dayIndex: number, exerciseId: string) {
    const ex = exerciseById.get(exerciseId)
    if (!ex) return
    const nextDays = days.map((d, i) =>
      i === dayIndex
        ? { ...d, entries: [...d.entries, { id: '', exerciseId, sets: ex.defaultSets, reps: ex.defaultReps, load: ex.defaultLoad, order: d.entries.length }] }
        : d,
    )
    saveDays(toPayload(nextDays))
    setPickerDayIndex(null)
  }

  function removeExercise(dayIndex: number, entryIndex: number) {
    const nextDays = days.map((d, i) => (i === dayIndex ? { ...d, entries: d.entries.filter((_, ei) => ei !== entryIndex) } : d))
    saveDays(toPayload(nextDays))
  }

  function addDay(dateIso: string) {
    saveDays(toPayload([...days, { id: '', label: trainingDayLabel(dateIso), order: days.length, entries: [] }]))
    setTrainingDate(null)
  }

  function removeDay(dayIndex: number) {
    saveDays(toPayload(days.filter((_, i) => i !== dayIndex)))
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div>
        <h1 className="text-xl font-bold">Упражнения и программа</h1>
        <p className="text-sm text-[var(--text-muted)]">Библиотека упражнений, ваша программа и история тренировок</p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'program', label: 'Программа' },
          { value: 'library', label: 'Библиотека' },
          { value: 'history', label: 'История' },
        ]}
      />

      {tab === 'program' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Badge tone={isSelf ? 'accent' : 'neutral'}>{isSelf || !program ? 'Ваша программа' : 'Назначено тренером'}</Badge>
            {isSelf && (
              <Button size="sm" variant="secondary" onClick={() => setTrainingDate(trainingDate === null ? todayIso() : null)}>
                <PlusCircle size={14} /> Добавить тренировку
              </Button>
            )}
          </div>

          {trainingDate !== null && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-2">
              <input
                autoFocus
                type="date"
                value={trainingDate}
                onChange={(e) => setTrainingDate(e.target.value)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              />
              <Button size="sm" disabled={!trainingDate} onClick={() => trainingDate && addDay(trainingDate)}>
                Добавить
              </Button>
              <button onClick={() => setTrainingDate(null)} className="text-xs text-[var(--text-muted)] hover:underline">
                Отмена
              </button>
            </div>
          )}

          {days.length === 0 && <EmptyState title="Программа ещё не составлена" subtitle={isSelf ? 'Добавьте первый день тренировок' : 'Дождитесь, пока тренер составит программу'} />}
          {days.length > 0 && visibleDays.length === 0 && <EmptyState title="Все запланированные тренировки выполнены" subtitle="Выполненные тренировки — во вкладке «Библиотека»" />}

          {visibleDays.map(({ day, dayIndex }) => (
            <Card key={day.id || dayIndex}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{day.label}</h3>
                <div className="flex items-center gap-2">
                  {day.entries.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => setLoggingDay(day)}>
                      Начать тренировку
                    </Button>
                  )}
                  {isSelf && days.length > 1 && (
                    <button onClick={() => removeDay(dayIndex)} className="text-xs text-red-500 hover:underline">
                      Удалить день
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {day.entries.map((entry, entryIndex) => {
                  const ex = exerciseById.get(entry.exerciseId)
                  if (!ex) return null
                  return (
                    <div key={entryIndex} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2">
                      <div>
                        <div className="text-sm font-medium">{ex.name}</div>
                        <div className="text-xs text-[var(--text-faint)]">
                          {entry.sets} × {entry.reps} · {entry.load} · {MUSCLE_GROUP_LABEL[ex.muscleGroup]}
                        </div>
                      </div>
                      {isSelf && (
                        <button onClick={() => removeExercise(dayIndex, entryIndex)} className="text-[var(--text-faint)] hover:text-red-500">
                          <MinusCircle size={17} />
                        </button>
                      )}
                    </div>
                  )
                })}
                {day.entries.length === 0 && <p className="text-xs text-[var(--text-faint)]">Упражнений пока нет</p>}
                {isSelf && (
                  <button
                    onClick={() => setPickerDayIndex(dayIndex)}
                    className="tap-scale mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] py-2 text-sm text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
                  >
                    <PlusCircle size={15} /> Добавить упражнение
                  </button>
                )}
              </div>

              {pickerDayIndex === dayIndex && (
                <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
                  {exercises.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => addExercise(dayIndex, ex.id)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-sunken)]"
                    >
                      <span>{ex.name}</span>
                      <span className="text-xs text-[var(--text-faint)]">{MUSCLE_GROUP_LABEL[ex.muscleGroup]}</span>
                    </button>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {tab === 'library' && (
        <div className="flex flex-col gap-3">
          {completedLogs.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Выполненные тренировки · {completedLogs.length}</h2>
              {completedLogs.map((log) => (
                <Card key={log.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold">{log.dayLabel}</span>{' '}
                      <span className="text-xs text-[var(--text-faint)]">{log.date.slice(0, 10)}</span>
                    </div>
                    <Badge tone="success">Выполнено</Badge>
                  </div>
                  {log.exercises.map((e, i) => {
                    const ex = exerciseById.get(e.exerciseId)
                    if (!ex) return null
                    return (
                      <div key={i} className="rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                        {ex.name}{' '}
                        <span className="text-xs text-[var(--text-faint)]">
                          · {e.sets.map((s) => `${s.reps} × ${s.load}`).join(', ')}
                        </span>
                      </div>
                    )
                  })}
                </Card>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setMuscleFilter('all')}
              className={`tap-scale rounded-lg px-2.5 py-1 text-xs font-medium ${muscleFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'}`}
            >
              Все
            </button>
            {MUSCLE_GROUPS.map((g) => (
              <button
                key={g}
                onClick={() => setMuscleFilter(g)}
                className={`tap-scale rounded-lg px-2.5 py-1 text-xs font-medium ${muscleFilter === g ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]'}`}
              >
                {MUSCLE_GROUP_LABEL[g]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {exercises
              .filter((e) => muscleFilter === 'all' || e.muscleGroup === muscleFilter)
              .map((ex) => {
                const images = getExerciseImages(ex)
                return (
                  <Card key={ex.id} className="flex h-full flex-col gap-2">
                    <div className="flex min-h-[42px] items-start justify-between gap-2">
                      <span className="font-medium leading-snug">{ex.name}</span>
                      <Badge tone="neutral">{MUSCLE_GROUP_LABEL[ex.muscleGroup]}</Badge>
                    </div>
                    {ex.imageUrl ? (
                      <div className="flex flex-col gap-1">
                        <img
                          src={`/${ex.imageUrl}`}
                          alt={ex.name}
                          loading="lazy"
                          className="h-32 w-full rounded-lg object-cover"
                        />
                        {ex.imageAttribution && (
                          <span className="text-[9px] text-[var(--text-faint)]">Фото: {ex.imageAttribution}</span>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {images.map((img) => (
                          <div key={img.phase} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className="flex h-16 w-full items-center justify-center rounded-lg text-2xl"
                              style={{ background: `hsl(${img.hue}, 65%, 92%)` }}
                            >
                              {img.emoji}
                            </div>
                            <span className="text-[10px] text-[var(--text-faint)]">{img.phase}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {ex.technique && <p className="flex-1 text-xs text-[var(--text-muted)]">{ex.technique}</p>}
                    <div className="text-xs text-[var(--text-faint)]">
                      По умолчанию: {ex.defaultSets} × {ex.defaultReps} · {ex.defaultLoad} · {ex.equipment}
                    </div>
                  </Card>
                )
              })}
          </div>
          <p className="text-center text-[10px] text-[var(--text-faint)]">
            Фото упражнений предоставлены открытой базой{' '}
            <a href="https://wger.de" target="_blank" rel="noreferrer" className="underline">
              wger.de
            </a>{' '}
            по лицензии Creative Commons (CC-BY-SA), автор указан под каждым фото.
          </p>
        </div>
      )}

      {tab === 'history' && (
        <div className="flex flex-col gap-2.5">
          {myLogs.length === 0 && <EmptyState title="История пока пуста" />}
          {myLogs.map((log) => {
            const st = STATUS_INFO[log.status]
            const Icon = st.icon
            return (
              <Card key={log.id} className="flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{log.date.slice(0, 10)}</span>
                    <span className="text-xs text-[var(--text-faint)]">{log.dayLabel}</span>
                  </div>
                  {log.exercises.length > 0 && (
                    <div className="mt-1 text-xs text-[var(--text-muted)]">
                      {log.exercises
                        .slice(0, 3)
                        .map((e) => exerciseById.get(e.exerciseId)?.name)
                        .filter(Boolean)
                        .join(', ')}
                      {log.exercises.length > 3 ? '…' : ''}
                    </div>
                  )}
                </div>
                <Badge tone={st.tone}>
                  <Icon size={12} className="mr-1 inline" />
                  {st.label}
                </Badge>
              </Card>
            )
          })}
        </div>
      )}

      {loggingDay && <WorkoutLogger open={!!loggingDay} onClose={() => setLoggingDay(null)} day={loggingDay} exerciseById={exerciseById} workoutLogs={workoutLogs ?? []} />}
    </div>
  )
}
