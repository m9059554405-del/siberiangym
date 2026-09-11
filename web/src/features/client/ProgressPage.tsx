import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Lock, Plus, User } from 'lucide-react'
import {
  useAddCycleLog,
  useAddMeasurement,
  useAddProgressPhoto,
  useExercises,
  useMe,
  useOwnCycleLogs,
  useOwnMeasurements,
  useOwnProgressPhotos,
  useOwnWorkoutLogs,
  useUpdateOwnProfile,
} from '../../hooks/useClientApi'
import { getMuscleLoadChange } from '../../lib/muscleLoad'
import { tariffUnlocksCoaching } from '../../data/tariffs'
import { computeCycleInfo } from '../../lib/femaleCycle'
import { BodyDiagram } from '../../components/BodyDiagram'
import { FeedbackThread } from '../../components/FeedbackThread'
import { PhotoTile } from '../../components/PhotoTile'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, EmptyState, SectionTitle, Tabs } from '../../components/ui/Primitives'
import { getInitials } from '../../lib/format'
import type { MealType, ProgressPhoto } from '../../types'

const PERIOD_OPTIONS = [
  { value: '7', label: 'Неделя' },
  { value: '30', label: 'Месяц' },
  { value: '90', label: '3 месяца' },
]

const MEASUREMENT_FIELDS = [
  ['weightKg', 'Вес, кг'],
  ['chestCm', 'Грудь, см'],
  ['waistCm', 'Талия, см'],
  ['hipsCm', 'Бёдра, см'],
  ['bodyFatPercent', '% жира'],
  ['muscleMassKg', 'Мышцы, кг'],
  ['waterPercent', '% воды'],
  ['visceralFat', 'Висцер. жир'],
] as const

const MEAL_LABELS: Record<MealType, string> = { BREAKFAST: 'Завтрак', LUNCH: 'Обед', DINNER: 'Ужин', OTHER: 'Прочее' }
const MEAL_ORDER: MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'OTHER']

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function CoachingLocked() {
  return (
    <Card className="flex flex-col items-center gap-2 py-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-sunken)] text-[var(--text-faint)]">
        <Lock size={18} />
      </div>
      <p className="text-sm font-medium">Доступно с тарифом «Ведение» или «Индивидуальные тренировки»</p>
      <p className="text-xs text-[var(--text-faint)]">Фото, замеры и обратная связь с тренером открываются на этих тарифах</p>
      <Link to="/client/trainer">
        <Button size="sm" className="mt-1">
          Выбрать тариф
        </Button>
      </Link>
    </Card>
  )
}

function MealSection({ mealType, photos }: { mealType: MealType; photos: ProgressPhoto[] }) {
  const addProgressPhoto = useAddProgressPhoto()
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(file: File | undefined) {
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    addProgressPhoto.mutate({ kind: 'FOOD', url: dataUrl, mealType })
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium">{MEAL_LABELS[mealType]}</span>
        <button onClick={() => inputRef.current?.click()} className="tap-scale flex items-center gap-1 text-xs font-medium text-[var(--accent-strong)]">
          <Camera size={13} /> Добавить
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="text-xs text-[var(--text-faint)]">Пока нет фото</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((p) => (
            <PhotoTile key={p.id} photo={p} size={72} />
          ))}
        </div>
      )}
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleUpload(e.target.files?.[0])} />
    </div>
  )
}

export function ProgressPage() {
  const { data: client } = useMe()
  const { data: workoutLogs } = useOwnWorkoutLogs()
  const { data: exercises } = useExercises()
  const { data: photos } = useOwnProgressPhotos()
  const { data: measurements } = useOwnMeasurements()
  const { data: cycleLogs } = useOwnCycleLogs()
  const addProgressPhoto = useAddProgressPhoto()
  const addMeasurement = useAddMeasurement()
  const updateProfile = useUpdateOwnProfile(client?.id)
  const addCycleLog = useAddCycleLog()

  const [section, setSection] = useState<'load' | 'about'>('load')
  const [periodDays, setPeriodDays] = useState('30')
  const [beforeId, setBeforeId] = useState<string>('')
  const [afterId, setAfterId] = useState<string>('')
  const [form, setForm] = useState<Record<(typeof MEASUREMENT_FIELDS)[number][0], string>>({
    weightKg: '', chestCm: '', waistCm: '', hipsCm: '',
    bodyFatPercent: '', muscleMassKg: '', waterPercent: '', visceralFat: '',
  })
  const [nameInput, setNameInput] = useState('')

  const bodyInputRef = useRef<HTMLInputElement>(null)
  const profileInputRef = useRef<HTMLInputElement>(null)

  const hasCoaching = tariffUnlocksCoaching(client?.tariff)

  const changes = useMemo(
    () => getMuscleLoadChange(workoutLogs ?? [], exercises ?? [], Number(periodDays)),
    [workoutLogs, exercises, periodDays],
  )
  const cardioChange = useMemo(() => changes.find((c) => c.muscleGroup === 'CARDIO'), [changes])
  const bodyChanges = useMemo(() => changes.filter((c) => c.muscleGroup !== 'CARDIO'), [changes])

  const myPhotos = useMemo(() => [...(photos ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [photos])
  const foodPhotos = myPhotos.filter((p) => p.kind === 'FOOD').slice().reverse()
  const bodyPhotos = myPhotos.filter((p) => p.kind === 'BODY')

  const myMeasurements = useMemo(() => [...(measurements ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [measurements])
  const latest = myMeasurements[myMeasurements.length - 1]
  const first = myMeasurements[0]

  const beforePhoto = bodyPhotos.find((p) => p.id === beforeId) ?? bodyPhotos[0]
  const afterPhoto = bodyPhotos.find((p) => p.id === afterId) ?? bodyPhotos[bodyPhotos.length - 1]

  const myCycleDates = useMemo(() => (cycleLogs ?? []).map((c) => c.date.slice(0, 10)), [cycleLogs])
  const cycleInfo = useMemo(() => computeCycleInfo(myCycleDates, new Date().toISOString().slice(0, 10)), [myCycleDates])

  if (!client) return null

  async function handleBodyUpload(file: File | undefined) {
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    addProgressPhoto.mutate({ kind: 'BODY', url: dataUrl })
  }
  async function handleProfileUpload(file: File | undefined) {
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    updateProfile.mutate({ profilePhotoUrl: dataUrl })
  }

  function submitMeasurement() {
    const parsed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() === '' ? undefined : Number(v)]))
    if (Object.values(parsed).every((v) => v === undefined)) return
    addMeasurement.mutate(parsed, {
      onSuccess: () =>
        setForm({ weightKg: '', chestCm: '', waistCm: '', hipsCm: '', bodyFatPercent: '', muscleMassKg: '', waterPercent: '', visceralFat: '' }),
    })
  }

  function saveName() {
    if (nameInput.trim()) updateProfile.mutate({ name: nameInput.trim() })
  }
  function saveBirthday(v: string) {
    updateProfile.mutate({ birthday: v })
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div>
        <h1 className="text-xl font-bold">Прогресс</h1>
        <p className="text-sm text-[var(--text-muted)]">Нагрузка по мышцам, фото, замеры и профиль</p>
      </div>

      <Tabs
        value={section}
        onChange={setSection}
        options={[
          { value: 'load', label: 'Нагрузка' },
          { value: 'about', label: 'Обо мне' },
        ]}
      />

      {section === 'load' && (
        <>
          <Card>
            <SectionTitle title="Нагрузка по мышцам" subtitle="Изменение относительно предыдущего периода" />
            <Tabs value={periodDays} onChange={setPeriodDays} options={PERIOD_OPTIONS} />
            <div className="mt-3">
              <BodyDiagram changes={bodyChanges} />
            </div>
            {cardioChange && (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                <span>Кардио-нагрузка</span>
                <span className="text-[var(--text-muted)]">
                  {cardioChange.pctChange === null ? 'нет данных' : `${cardioChange.pctChange >= 0 ? '+' : ''}${cardioChange.pctChange}%`}
                </span>
              </div>
            )}
          </Card>

          {!hasCoaching ? (
            <CoachingLocked />
          ) : (
            <>
              <Card>
                <SectionTitle
                  title="Замеры"
                  subtitle={latest ? `Последний замер: ${latest.date.slice(0, 10)}` : 'Пока нет данных'}
                  action={
                    first && latest && first !== latest && first.weightKg && latest.weightKg ? (
                      <Badge tone={latest.weightKg <= first.weightKg ? 'success' : 'accent'}>
                        {(latest.weightKg - first.weightKg).toFixed(1)} кг с начала
                      </Badge>
                    ) : undefined
                  }
                />
                {myMeasurements.length > 0 && (
                  <div className="mb-3 overflow-x-auto">
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
                        {myMeasurements.map((m) => (
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
                <p className="mb-1 text-xs font-medium text-[var(--text-muted)]">Биоимпедансометрия</p>
                <p className="mb-2 text-xs text-[var(--text-faint)]">Все поля необязательны — заполните только то, что измерили.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {MEASUREMENT_FIELDS.map(([key, label]) => (
                    <div key={key} className="flex flex-col gap-1">
                      <label className="text-[10px] text-[var(--text-faint)]">{label}</label>
                      <input
                        type="number"
                        value={form[key]}
                        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  ))}
                </div>
                <Button size="sm" className="mt-3" onClick={submitMeasurement} disabled={addMeasurement.isPending}>
                  <Plus size={14} /> Сохранить замер
                </Button>
              </Card>

              <Card>
                <SectionTitle title="Фото «было / стало»" subtitle="Полный рост, для сравнения динамики" />
                {bodyPhotos.length === 0 ? (
                  <EmptyState title="Пока нет фото в полный рост" />
                ) : (
                  <div className="flex items-center justify-around gap-3">
                    <div className="flex flex-col items-center gap-2">
                      <select value={beforePhoto?.id} onChange={(e) => setBeforeId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-xs">
                        {bodyPhotos.map((p) => (
                          <option key={p.id} value={p.id}>{p.date.slice(0, 10)}</option>
                        ))}
                      </select>
                      {beforePhoto && <PhotoTile photo={beforePhoto} size={120} />}
                      <span className="text-xs text-[var(--text-faint)]">Было</span>
                    </div>
                    <div className="text-lg text-[var(--text-faint)]">→</div>
                    <div className="flex flex-col items-center gap-2">
                      <select value={afterPhoto?.id} onChange={(e) => setAfterId(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-xs">
                        {bodyPhotos.map((p) => (
                          <option key={p.id} value={p.id}>{p.date.slice(0, 10)}</option>
                        ))}
                      </select>
                      {afterPhoto && <PhotoTile photo={afterPhoto} size={120} />}
                      <span className="text-xs text-[var(--text-faint)]">Стало</span>
                    </div>
                  </div>
                )}
                <input ref={bodyInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleBodyUpload(e.target.files?.[0])} />
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => bodyInputRef.current?.click()}>
                  <Camera size={14} /> Загрузить фото в полный рост
                </Button>
              </Card>

              <Card>
                <SectionTitle title="Фото еды" subtitle="Покажите тренеру, что едите — по приёмам пищи" />
                <div className="flex flex-col gap-3">
                  {MEAL_ORDER.map((mealType) => (
                    <MealSection key={mealType} mealType={mealType} photos={foodPhotos.filter((p) => (p.mealType ?? 'OTHER') === mealType)} />
                  ))}
                </div>
              </Card>

              <FeedbackThread clientId={client.id} viewer="client" />
            </>
          )}
        </>
      )}

      {section === 'about' && (
        <>
          <Card className="flex flex-col items-center gap-3 py-6 text-center">
            {client.profilePhotoUrl ? (
              <div className="h-24 w-24 rounded-full bg-cover bg-center" style={{ backgroundImage: `url(${client.profilePhotoUrl})` }} />
            ) : (
              <Avatar initials={getInitials(client.name)} hue={client.avatarHue} size={96} />
            )}
            <input ref={profileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleProfileUpload(e.target.files?.[0])} />
            <Button size="sm" variant="secondary" onClick={() => profileInputRef.current?.click()}>
              <User size={14} /> Изменить фото профиля
            </Button>
          </Card>

          <Card>
            <SectionTitle title="Личные данные" />
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-faint)]">ФИО</label>
                <div className="flex gap-2">
                  <input
                    defaultValue={client.name}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <Button size="sm" onClick={saveName}>Сохранить</Button>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-[var(--text-faint)]">Дата рождения</label>
                <input
                  type="date"
                  defaultValue={client.birthday?.slice(0, 10)}
                  onChange={(e) => saveBirthday(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </Card>

          {client.gender === 'F' && (
            <Card>
              <SectionTitle title="Женский календарь" subtitle="Отслеживание цикла" />
              {cycleInfo ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                    <span>День цикла</span>
                    <span className="font-semibold">{cycleInfo.cycleDay} из {cycleInfo.avgLength}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                    <span>Фаза</span>
                    <Badge tone="accent">{cycleInfo.phase}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                    <span>Ожидаемое начало следующего цикла</span>
                    <span className="font-medium">{cycleInfo.nextPredicted}</span>
                  </div>
                </div>
              ) : (
                <EmptyState title="Нет данных о цикле" subtitle="Отметьте дату начала, чтобы начать отслеживание" />
              )}
              <Button size="sm" className="mt-3" onClick={() => addCycleLog.mutate()} disabled={addCycleLog.isPending}>
                <Plus size={14} /> Отметить начало цикла сегодня
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
