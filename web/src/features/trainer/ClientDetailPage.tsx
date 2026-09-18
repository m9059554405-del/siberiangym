import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MinusCircle, PlusCircle, TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useExercises, useProgram } from '../../hooks/useClientApi'
import { useClientDetail, useMeasurementsForClient, useProgressPhotosForClient, useSetClientProgram, useWorkoutLogsForClient } from '../../hooks/useTrainerApi'
import { getMuscleLoadChange } from '../../lib/muscleLoad'
import { MUSCLE_GROUP_LABEL } from '../../data/exercises'
import { tariffUnlocksCoaching } from '../../data/tariffs'
import { Avatar } from '../../components/ui/Avatar'
import { BodyDiagram } from '../../components/BodyDiagram'
import { FeedbackThread } from '../../components/FeedbackThread'
import { PhotoTile } from '../../components/PhotoTile'
import { TariffBadge } from '../../components/TariffBadge'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { getInitials } from '../../lib/format'
import type { ClientFormat, ProgramDay } from '../../types'

const FORMAT_LABEL: Record<ClientFormat, string> = { PERSONAL: 'Персонально', GROUP: 'Группа', SELF: 'Самостоятельно' }
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = { COMPLETED: 'success', PARTIAL: 'warning', MISSED: 'danger' }
const STATUS_LABEL: Record<string, string> = { COMPLETED: 'Выполнено', PARTIAL: 'Частично', MISSED: 'Пропущено' }

function parseKg(load: string): number | null {
  const m = /^(\d+(?:\.\d+)?)\s*кг$/.exec(load)
  return m ? parseFloat(m[1]) : null
}

export function ClientDetailPage() {
  const { clientId } = useParams()
  const { data: client } = useClientDetail(clientId)
  const { data: program } = useProgram(clientId)
  const { data: exercises } = useExercises()
  const { data: logs } = useWorkoutLogsForClient(clientId)
  const { data: measurements } = useMeasurementsForClient(clientId)
  const { data: photos } = useProgressPhotosForClient(clientId)
  const setProgram = useSetClientProgram(clientId)
  const [pickerDayIndex, setPickerDayIndex] = useState<number | null>(null)
  const [exerciseQuery, setExerciseQuery] = useState('')

  const exerciseById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const normalizeSearch = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim()
  const filteredExercises = useMemo(() => {
    const q = normalizeSearch(exerciseQuery)
    if (!q) return exercises ?? []
    return (exercises ?? []).filter((ex) => normalizeSearch(ex.name).includes(q))
  }, [exercises, exerciseQuery])
  const muscleChanges = useMemo(
    () => getMuscleLoadChange(logs ?? [], exercises ?? [], 30).filter((c) => c.muscleGroup !== 'CARDIO'),
    [logs, exercises],
  )
  const sortedLogs = useMemo(() => [...(logs ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [logs])
  const sortedMeasurements = useMemo(() => [...(measurements ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [measurements])
  const latestMeasurement = sortedMeasurements[sortedMeasurements.length - 1]
  const sortedPhotos = useMemo(() => [...(photos ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [photos])

  const progressData = useMemo(() => {
    const freq = new Map<string, number>()
    for (const log of logs ?? []) {
      for (const ex of log.exercises) {
        if (parseKg(ex.sets[0]?.load ?? '') === null) continue
        freq.set(ex.exerciseId, (freq.get(ex.exerciseId) ?? 0) + 1)
      }
    }
    let keyExerciseId: string | null = null
    let max = 0
    for (const [id, count] of freq) {
      if (count > max) {
        max = count
        keyExerciseId = id
      }
    }
    if (!keyExerciseId) return { keyExerciseId: null, points: [] as { date: string; weight: number }[] }
    const points = [...(logs ?? [])]
      .filter((l) => l.status !== 'MISSED')
      .reverse()
      .map((log) => {
        const entry = log.exercises.find((e) => e.exerciseId === keyExerciseId)
        if (!entry) return null
        const weights = entry.sets.map((s) => parseKg(s.load)).filter((w): w is number => w !== null)
        if (weights.length === 0) return null
        return { date: log.date.slice(5, 10), weight: Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) }
      })
      .filter((p): p is { date: string; weight: number } => p !== null)
    return { keyExerciseId, points }
  }, [logs])

  if (!client) return <EmptyState title="Клиент не найден" />

  const hasCoaching = tariffUnlocksCoaching(client.tariff)
  const days = program?.days ?? []

  function toPayload(list: ProgramDay[]) {
    return list.map((d, i) => ({
      label: d.label,
      order: i,
      entries: d.entries.map((e, ei) => ({ exerciseId: e.exerciseId, sets: e.sets, reps: e.reps, load: e.load, order: ei })),
    }))
  }
  function saveDays(next: ProgramDay[]) {
    setProgram.mutate(toPayload(next))
  }
  function addExercise(dayIndex: number, exerciseId: string) {
    const ex = exerciseById.get(exerciseId)
    if (!ex) return
    saveDays(
      days.map((d, i) =>
        i === dayIndex
          ? { ...d, entries: [...d.entries, { id: '', exerciseId, sets: ex.defaultSets, reps: ex.defaultReps, load: ex.defaultLoad, order: d.entries.length }] }
          : d,
      ),
    )
    setPickerDayIndex(null)
    setExerciseQuery('')
  }
  function removeExercise(dayIndex: number, entryIndex: number) {
    saveDays(days.map((d, i) => (i === dayIndex ? { ...d, entries: d.entries.filter((_, ei) => ei !== entryIndex) } : d)))
  }
  function addDay() {
    saveDays([...days, { id: '', label: `День ${days.length + 1} — новая тренировка`, order: days.length, entries: [] }])
  }
  function removeDay(dayIndex: number) {
    saveDays(days.filter((_, i) => i !== dayIndex))
  }

  const keyExercise = progressData.keyExerciseId ? exerciseById.get(progressData.keyExerciseId) : null

  return (
    <div className="flex flex-col gap-4">
      <Link to="/trainer" className="flex w-fit items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
        <ArrowLeft size={15} /> К списку подопечных
      </Link>

      <Card className="flex items-center gap-3">
        <Avatar initials={getInitials(client.name)} hue={client.avatarHue} size={56} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{client.name}</span>
            <Badge tone="accent">{FORMAT_LABEL[client.format]}</Badge>
            <TariffBadge tariff={client.tariff} />
          </div>
          <div className="text-sm text-[var(--text-muted)]">
            В клубе с {client.joinedAt.slice(0, 10)} · {client.membership?.status === 'ACTIVE' ? 'Активный абонемент' : 'Абонемент неактивен'}
          </div>
        </div>
      </Card>

      {progressData.points.length >= 2 && keyExercise && (
        <Card>
          <SectionTitle title="Прогресс рабочего веса" subtitle={keyExercise.name} action={<TrendingUp size={18} className="text-[var(--accent-strong)]" />} />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={progressData.points} margin={{ left: -20, right: 10, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" fontSize={11} stroke="var(--text-faint)" />
                <YAxis fontSize={11} stroke="var(--text-faint)" unit=" кг" />
                <Tooltip formatter={(v: any) => [`${v} кг`, keyExercise.name]} />
                <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle
          title="Текущая программа"
          subtitle={program ? `Обновлено ${program.updatedAt.slice(0, 10)} · назначил: ${program.assignedBy === 'trainer' ? 'тренер' : 'клиент'}` : 'Программа ещё не составлена'}
          action={
            <Button size="sm" variant="secondary" onClick={addDay}>
              <PlusCircle size={14} /> День
            </Button>
          }
        />
        <div className="flex flex-col gap-3">
          {days.map((day, dayIndex) => (
            <div key={day.id || dayIndex} className="rounded-xl border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{day.label}</h4>
                {days.length > 1 && (
                  <button onClick={() => removeDay(dayIndex)} className="text-xs text-red-500 hover:underline">
                    Удалить день
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {day.entries.map((entry, entryIndex) => {
                  const ex = exerciseById.get(entry.exerciseId)
                  if (!ex) return null
                  return (
                    <div key={entryIndex} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-1.5 text-sm">
                      <span>
                        {ex.name} <span className="text-[var(--text-faint)]">· {entry.sets}×{entry.reps} · {entry.load}</span>
                      </span>
                      <button onClick={() => removeExercise(dayIndex, entryIndex)} className="text-[var(--text-faint)] hover:text-red-500">
                        <MinusCircle size={15} />
                      </button>
                    </div>
                  )
                })}
                <button
                  onClick={() => {
                    setPickerDayIndex(pickerDayIndex === dayIndex ? null : dayIndex)
                    setExerciseQuery('')
                  }}
                  className="tap-scale mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] py-1.5 text-xs text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
                >
                  <PlusCircle size={13} /> Добавить упражнение
                </button>
                {pickerDayIndex === dayIndex && (
                  <div className="mt-1 rounded-lg border border-[var(--border)] p-1.5">
                    <input
                      autoFocus
                      value={exerciseQuery}
                      onChange={(e) => setExerciseQuery(e.target.value)}
                      placeholder="Начните вводить название упражнения…"
                      className="mb-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                    />
                    <div className="max-h-48 overflow-y-auto">
                      {filteredExercises.length > 0 ? (
                        filteredExercises.map((ex) => (
                          <button
                            key={ex.id}
                            onClick={() => addExercise(dayIndex, ex.id)}
                            className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-[var(--surface-sunken)]"
                          >
                            <span>{ex.name}</span>
                            <span className="text-[var(--text-faint)]">{MUSCLE_GROUP_LABEL[ex.muscleGroup]}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-2 py-3 text-center text-xs text-[var(--text-faint)]">Ничего не найдено</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="История тренировок" subtitle={`${sortedLogs.length} записей`} />
        <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {sortedLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{log.date.slice(0, 10)}</span>{' '}
                <span className="text-[var(--text-faint)]">{log.dayLabel}</span>
              </div>
              <Badge tone={STATUS_TONE[log.status]}>{STATUS_LABEL[log.status]}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle title="Прогресс по мышцам" subtitle="Изменение нагрузки за последние 30 дней" />
        <BodyDiagram changes={muscleChanges} />
      </Card>

      {!hasCoaching ? (
        <Card className="flex flex-col items-center gap-1 py-8 text-center">
          <p className="text-sm font-medium">Клиент на тарифе «Базовый»</p>
          <p className="text-xs text-[var(--text-faint)]">Замеры, фотоотчёты и обратная связь открываются на тарифах «Ведение» и «Индивидуальные тренировки»</p>
        </Card>
      ) : (
        <>
          <Card>
            <SectionTitle title="Замеры" subtitle={latestMeasurement ? `Последний замер: ${latestMeasurement.date.slice(0, 10)}` : 'Клиент ещё не вносил замеры'} />
            {sortedMeasurements.length === 0 ? (
              <EmptyState title="Нет данных" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-xs">
                  <thead>
                    <tr className="text-left text-[var(--text-faint)]">
                      <th className="pb-1.5">Дата</th>
                      <th className="pb-1.5">Вес</th>
                      <th className="pb-1.5">Грудь</th>
                      <th className="pb-1.5">Талия</th>
                      <th className="pb-1.5">Бёдра</th>
                      <th className="pb-1.5">% жира</th>
                      <th className="pb-1.5">Мышцы</th>
                      <th className="pb-1.5">% воды</th>
                      <th className="pb-1.5">Висц. жир</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMeasurements.map((m) => (
                      <tr key={m.id} className="border-t border-[var(--border)]">
                        <td className="py-1.5">{m.date.slice(0, 10)}</td>
                        <td>{m.weightKg ? `${m.weightKg} кг` : '—'}</td>
                        <td>{m.chestCm ? `${m.chestCm} см` : '—'}</td>
                        <td>{m.waistCm ? `${m.waistCm} см` : '—'}</td>
                        <td>{m.hipsCm ? `${m.hipsCm} см` : '—'}</td>
                        <td>{m.bodyFatPercent ? `${m.bodyFatPercent}%` : '—'}</td>
                        <td>{m.muscleMassKg ? `${m.muscleMassKg} кг` : '—'}</td>
                        <td>{m.waterPercent ? `${m.waterPercent}%` : '—'}</td>
                        <td>{m.visceralFat ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle title="Фото от клиента" subtitle="Еда и фото в полный рост" />
            {sortedPhotos.length === 0 ? (
              <EmptyState title="Клиент пока не загружал фото" />
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {sortedPhotos.map((p) => (
                  <PhotoTile key={p.id} photo={p} />
                ))}
              </div>
            )}
          </Card>

          {clientId && <FeedbackThread clientId={clientId} viewer="trainer" />}
        </>
      )}
    </div>
  )
}
