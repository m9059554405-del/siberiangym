import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Plus, UserPlus } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useGroupClasses, usePersonalSlots, useTrainers } from '../../hooks/useClientApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { useCreateTrainer, useCreateTrainerLogin } from '../../hooks/useCeoApi'
import { getTrainerLoad } from '../../lib/ceoSelectors'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, SectionTitle, StatTile } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { getInitials } from '../../lib/format'

function AddTrainerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createTrainer = useCreateTrainer()
  const [name, setName] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [experienceYears, setExperienceYears] = useState(1)
  const [personalSessionPrice, setPersonalSessionPrice] = useState(2000)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const createLogin = useCreateTrainerLogin(createdId ?? undefined)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginDone, setLoginDone] = useState(false)

  function reset() {
    setName(''); setSpecialization(''); setExperienceYears(1); setPersonalSessionPrice(2000)
    setCreatedId(null); setLoginEmail(''); setLoginPassword(''); setLoginDone(false)
  }

  function submit() {
    if (!name.trim() || !specialization.trim()) return
    createTrainer.mutate(
      { name: name.trim(), specialization: specialization.trim(), experienceYears, personalSessionPrice },
      { onSuccess: (t: any) => setCreatedId(t.id) },
    )
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title="Новый тренер">
      {!createdId ? (
        <div className="flex flex-col gap-3">
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
          <Button onClick={submit} disabled={!name.trim() || !specialization.trim() || createTrainer.isPending}>
            <Plus size={14} /> Создать тренера
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <Badge tone="success">Тренер создан ✓</Badge>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Доступ в приложение</div>
          {loginDone ? (
            <Badge tone="success">Доступ выдан ✓</Badge>
          ) : (
            <>
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email для входа"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
              <input type="text" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Временный пароль (мин. 8 символов)"
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
              <Button size="sm" variant="secondary" disabled={!loginEmail.trim() || loginPassword.length < 8 || createLogin.isPending}
                onClick={() => createLogin.mutate({ email: loginEmail, password: loginPassword }, { onSuccess: () => setLoginDone(true) })}>
                <UserPlus size={13} /> Выдать доступ
              </Button>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export function TrainerLoadPage() {
  const { data: trainers } = useTrainers()
  const { data: clients } = useAllClients()
  const { data: groupClasses } = useGroupClasses()
  const { data: personalSlots } = usePersonalSlots()
  const [addOpen, setAddOpen] = useState(false)

  if (!trainers || !clients || !groupClasses || !personalSlots) return null

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
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Новый тренер
        </Button>
      </div>
      <AddTrainerModal open={addOpen} onClose={() => setAddOpen(false)} />

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
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="personal" name="Персонально" stackId="a" fill="var(--ceo-accent)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="group" name="Группы" stackId="a" fill="#3b82f6" />
              <Bar dataKey="self" name="Самостоятельно" stackId="a" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
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
