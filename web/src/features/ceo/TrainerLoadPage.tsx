import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, ShieldPlus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGroupClasses, usePersonalSlots, useTrainers } from '../../hooks/useClientApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { useCreateStaff, useCreateTrainer, type CreateTrainerPayload } from '../../hooks/useCeoApi'
import { useNetworkGyms } from '../../hooks/useGymsApi'
import { useAuthStore } from '../../store/useAuthStore'
import { getTrainerLoad } from '../../lib/ceoSelectors'
import { NetworkGymFilter } from './NetworkGymFilter'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, SectionTitle, StatTile } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { ApiError } from '../../lib/api'
import { getInitials } from '../../lib/format'
import type { EmploymentType } from '../../types'

const EMPLOYMENT_LABEL: Record<EmploymentType, string> = {
  EMPLOYEE: 'Штатный сотрудник',
  SELF_EMPLOYED: 'Самозанятый',
  SOLE_PROPRIETOR: 'ИП',
}

// Инструмент CEO «Завести администратора» (P1.10) — в отличие от тренера,
// у STAFF нет отдельной карточки-сущности, поэтому это один шаг, а не два.
function AddStaffModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createStaff = useCreateStaff()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  function reset() {
    setName(''); setEmail(''); setPhone(''); setPassword(''); setError(null); setDone(false)
  }

  function submit() {
    if (!name.trim() || !email.trim() || password.length < 8) return
    setError(null)
    createStaff.mutate(
      { name: name.trim(), email: email.trim(), phone: phone.trim() || undefined, password },
      { onSuccess: () => setDone(true), onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось создать администратора') },
    )
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Новый администратор">
      {done ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Badge tone="success">Администратор создан ✓</Badge>
          <p className="text-sm text-[var(--text-muted)]">Логин и пароль можно передать сотруднику — доступ уже активен.</p>
          <Button variant="secondary" onClick={() => { reset(); onClose() }}>Готово</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email для входа"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон (необязательно)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Временный пароль (мин. 8 символов)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { reset(); onClose() }}>Отмена</Button>
            <Button className="flex-1" onClick={submit} disabled={!name.trim() || !email.trim() || password.length < 8 || createStaff.isPending}>
              <ShieldPlus size={14} /> Создать администратора
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// P1.4: "в один проход" — карточка, статус занятости, точки сети,
// согласие сотрудника и логин заводятся одним действием CEO, а не
// несколькими отдельными шагами, как было раньше (create → create-login).
function AddTrainerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const role = useAuthStore((s) => s.user?.role)
  const currentGymId = useAuthStore((s) => s.user?.gymId)
  const createTrainer = useCreateTrainer()
  const { data: allNetworkGyms } = useNetworkGyms()
  const networkGyms = allNetworkGyms?.filter((g) => g.id !== currentGymId)
  const [name, setName] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [experienceYears, setExperienceYears] = useState(1)
  const [personalSessionPrice, setPersonalSessionPrice] = useState(2000)
  const [employmentType, setEmploymentType] = useState<EmploymentType>('EMPLOYEE')
  const [revenueSharePercent, setRevenueSharePercent] = useState('')
  const [additionalGymIds, setAdditionalGymIds] = useState<string[]>([])
  const [staffConsentGranted, setStaffConsentGranted] = useState(false)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setName(''); setSpecialization(''); setExperienceYears(1); setPersonalSessionPrice(2000)
    setEmploymentType('EMPLOYEE'); setRevenueSharePercent(''); setAdditionalGymIds([]); setStaffConsentGranted(false)
    setLoginEmail(''); setLoginPassword(''); setDone(false); setError(null)
  }

  function submit() {
    if (!name.trim() || !specialization.trim()) return
    setError(null)
    const payload: CreateTrainerPayload = {
      name: name.trim(),
      specialization: specialization.trim(),
      experienceYears,
      personalSessionPrice,
      employmentType,
      revenueSharePercent: revenueSharePercent.trim() ? Number(revenueSharePercent) : undefined,
      additionalGymIds: additionalGymIds.length ? additionalGymIds : undefined,
      staffConsentGranted,
      loginEmail: loginEmail.trim() || undefined,
      loginPassword: loginPassword.trim() || undefined,
    }
    createTrainer.mutate(payload, {
      onSuccess: () => setDone(true),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось создать тренера'),
    })
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Новый тренер">
      {done ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <Badge tone="success">Тренер создан ✓</Badge>
          <p className="text-sm text-[var(--text-muted)]">
            {loginEmail.trim() ? 'Логин и пароль можно передать тренеру — доступ уже активен.' : 'Доступ в приложение можно выдать позже из карточки тренера.'}
          </p>
          <Button variant="secondary" onClick={() => { reset(); onClose() }}>Готово</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя Фамилия"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="Специализация"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-faint)]">Опыт, лет</span>
              <input type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-faint)]">Цена перс. тренировки, ₽</span>
              <input type="number" min={0} value={personalSessionPrice} onChange={(e) => setPersonalSessionPrice(Number(e.target.value))}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-faint)]">Статус занятости</span>
              <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
                {(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((t) => <option key={t} value={t}>{EMPLOYMENT_LABEL[t]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-faint)]">% от выручки (необязательно)</span>
              <input type="number" min={0} max={100} value={revenueSharePercent} onChange={(e) => setRevenueSharePercent(e.target.value)} placeholder="напр. 40"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            </label>
          </div>
          {role === 'CEO' && networkGyms && networkGyms.length > 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--text-faint)]">Дополнительные точки сети (кроме текущей)</span>
              <select multiple value={additionalGymIds} onChange={(e) => setAdditionalGymIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
                {networkGyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={staffConsentGranted} onChange={(e) => setStaffConsentGranted(e.target.checked)} />
            Подписал согласие на обработку персональных данных как сотрудник
          </label>
          <div className="border-t border-[var(--border)] pt-3">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Доступ в приложение (необязательно)</div>
            <div className="flex flex-col gap-2">
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email для входа"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
              <input type="text" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Временный пароль (мин. 8 символов)"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { reset(); onClose() }}>Отмена</Button>
            <Button
              className="flex-1"
              onClick={submit}
              disabled={!name.trim() || !specialization.trim() || (!!loginEmail.trim() && loginPassword.length < 8) || createTrainer.isPending}
            >
              <Plus size={14} /> Создать тренера
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function TrainerLoadPage() {
  // Страница CEO-only: подопечные нужны по всей сети (P1.7), ведь клиенты
  // тренера живут в разных точках.
  const { data: allTrainers } = useTrainers()
  const { data: allClients } = useAllClients(true)
  const { data: allClasses } = useGroupClasses()
  const { data: allSlots } = usePersonalSlots()
  const [addOpen, setAddOpen] = useState(false)
  const [addStaffOpen, setAddStaffOpen] = useState(false)
  const [gym, setGym] = useState('')

  // Фиды уже отдают всю сеть (P1.7) — фильтр по точке считается на клиенте.
  const trainers = useMemo(
    () => (allTrainers ?? []).filter((t) => !gym || t.gymId === gym || t.additionalGyms?.some((a) => a.gymId === gym)),
    [allTrainers, gym],
  )
  const clients = useMemo(() => (allClients ?? []).filter((c) => !gym || c.gymId === gym), [allClients, gym])
  const groupClasses = useMemo(() => (allClasses ?? []).filter((c) => !gym || c.gymId === gym), [allClasses, gym])
  const personalSlots = useMemo(() => (allSlots ?? []).filter((s) => !gym || s.gymId === gym), [allSlots, gym])

  if (!allTrainers || !allClients || !allClasses || !allSlots) return null

  const rows = getTrainerLoad(trainers, clients, groupClasses, personalSlots)
  const totalClasses7d = rows.reduce((s, r) => s + r.classesNext7Days, 0)
  const totalPersonal7d = rows.reduce((s, r) => s + r.personalSlotsBookedNext7Days, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Загрузка тренеров</h1>
          <p className="text-sm text-[var(--text-muted)]">Подопечные, занятость и сравнение нагрузки между тренерами</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NetworkGymFilter value={gym} onChange={setGym} />
          <Button size="sm" variant="secondary" onClick={() => setAddStaffOpen(true)}>
            <ShieldPlus size={14} /> Новый администратор
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Новый тренер
          </Button>
        </div>
      </div>
      <AddTrainerModal open={addOpen} onClose={() => setAddOpen(false)} />
      <AddStaffModal open={addStaffOpen} onClose={() => setAddStaffOpen(false)} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Тренеров" value={trainers.length} />
        <StatTile label="Клиентов всего" value={clients.length} />
        <StatTile label="Групп. занятий за 7 дн." value={totalClasses7d} />
        <StatTile label="Перс. слотов за 7 дн." value={totalPersonal7d} />
      </div>

      <Card>
        <SectionTitle title="Клиенты по тренерам" subtitle="Разбивка по формату занятий" />
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--text-faint)" tickFormatter={(v: string) => v.split(' ')[0]} />
              <YAxis fontSize={11} stroke="var(--text-faint)" allowDecimals={false} />
              <Tooltip isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="personal" name="Персонально" stackId="a" fill="var(--ceo-accent)" isAnimationActive={false} />
              <Bar dataKey="group" name="Группы" stackId="a" fill="#3b82f6" isAnimationActive={false} />
              <Bar dataKey="self" name="Самостоятельно" stackId="a" fill="#bfdbfe" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Подробности по тренерам" subtitle="Нажмите на тренера, чтобы увидеть подопечных и оплаты" />
        <div className="flex flex-col gap-2">
          {rows.map((r) => (
            <Link key={r.trainerId} to={`/ceo/trainers/${r.trainerId}`}>
              <div className="tap-scale flex flex-wrap items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-[var(--surface-sunken)]">
                <Avatar initials={getInitials(r.name)} hue={r.avatarHue} size={32} />
                <div className="min-w-[140px] flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-[var(--text-faint)]">{r.specialization}</div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
                  <span>Всего: <b className="text-[var(--text)]">{r.total}</b></span>
                  <span>Перс.: {r.personal}</span>
                  <span>Группы: {r.group}</span>
                  <span>Самост.: {r.self}</span>
                  <span>{r.weeklyWorkHours} ч/нед</span>
                  <span>{r.classesNext7Days + r.personalSlotsBookedNext7Days} занятий за 7 дн.</span>
                </div>
                <ChevronRight size={16} className="shrink-0 text-[var(--text-faint)]" />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
