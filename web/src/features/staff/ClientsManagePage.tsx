import { useMemo, useState, type PropsWithChildren } from 'react'
import { Plus, RefreshCcw, UserCog, UserPlus } from 'lucide-react'
import { useChangeTariff, useChooseTrainer, useGoSelfTraining, usePurchaseMembership, useTrainers } from '../../hooks/useClientApi'
import { useAllClients, useCreateClient, useCreateClientLogin, useUpdateClient, type CreateClientPayload } from '../../hooks/useStaffApi'
import { TARIFFS } from '../../data/tariffs'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { ClientOutreachList } from '../../components/ClientOutreachList'
import { formatMoney, getInitials } from '../../lib/format'
import { usePricing } from '../../hooks/useClientApi'
import type { Client, Gender, MembershipType, Tariff } from '../../types'

function Field({ label, children }: PropsWithChildren<{ label: string }>) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[var(--text-muted)]">{label}</span>
      {children}
    </label>
  )
}

const FORMAT_LABEL: Record<string, string> = { PERSONAL: 'Персонально', GROUP: 'Группа', SELF: 'Самостоятельно' }
const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger'> = { ACTIVE: 'success', FROZEN: 'warning', EXPIRED: 'danger' }
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Активен', FROZEN: 'Заморожен', EXPIRED: 'Истёк' }
const MEMBERSHIP_LABEL: Record<MembershipType, string> = {
  SINGLE: 'Разовое занятие', MONTHLY: 'Абонемент на месяц', PACK10: 'Пакет на 10 занятий', PACK20: 'Пакет на 20 занятий',
}

interface ClientDraft {
  name: string
  gender: Gender
  birthday: string
  phone: string
  email: string
  trainerId: string
  tariff: Tariff
  membershipType: MembershipType
}

const EMPTY_DRAFT: ClientDraft = { name: '', gender: 'F', birthday: '2000-01-01', phone: '', email: '', trainerId: '', tariff: 'BASIC', membershipType: 'MONTHLY' }

type SortMode = 'joined_desc' | 'name_asc' | 'name_desc' | 'expires_asc' | 'expires_desc'
const SORT_LABEL: Record<SortMode, string> = {
  joined_desc: 'Сначала новые',
  name_asc: 'По имени А→Я',
  name_desc: 'По имени Я→А',
  expires_asc: 'Абонемент — скоро истекает',
  expires_desc: 'Абонемент — дольше действует',
}

export function ClientsManagePage() {
  const { data: clients } = useAllClients()
  const { data: trainers } = useTrainers()
  const { data: pricing } = usePricing()
  const createClient = useCreateClient()
  const updateClient = useUpdateClient()
  const chooseTrainer = useChooseTrainer(undefined)
  const changeTariff = useChangeTariff(undefined)
  const goSelfTraining = useGoSelfTraining(undefined)
  const purchaseMembership = usePurchaseMembership(undefined)

  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<ClientDraft>(EMPTY_DRAFT)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ClientDraft>(EMPTY_DRAFT)
  const [renewType, setRenewType] = useState<MembershipType>('MONTHLY')

  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('joined_desc')

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = q
      ? (clients ?? []).filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q))
      : clients ?? []
    const sorted = [...filtered]
    switch (sortMode) {
      case 'name_asc': sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru')); break
      case 'name_desc': sorted.sort((a, b) => b.name.localeCompare(a.name, 'ru')); break
      case 'expires_asc': sorted.sort((a, b) => (a.membership?.expiresAt ?? '9999-99-99').localeCompare(b.membership?.expiresAt ?? '9999-99-99')); break
      case 'expires_desc': sorted.sort((a, b) => (b.membership?.expiresAt ?? '').localeCompare(a.membership?.expiresAt ?? '')); break
      default: sorted.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt))
    }
    return sorted
  }, [clients, search, sortMode])

  const editingClient = (clients ?? []).find((c) => c.id === editingId) ?? null
  const createLogin = useCreateClientLogin(editingId ?? undefined)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginDone, setLoginDone] = useState(false)

  function openCreate() {
    setCreateDraft(EMPTY_DRAFT)
    setCreateOpen(true)
  }

  function submitCreate() {
    if (!createDraft.name.trim()) return
    const payload: CreateClientPayload = {
      name: createDraft.name.trim(),
      gender: createDraft.gender,
      birthday: createDraft.birthday,
      phone: createDraft.phone.trim() || undefined,
      email: createDraft.email.trim() || undefined,
      trainerId: createDraft.trainerId || null,
      tariff: createDraft.trainerId ? createDraft.tariff : null,
      membershipType: createDraft.membershipType,
    }
    createClient.mutate(payload, { onSuccess: () => setCreateOpen(false) })
  }

  function openEdit(c: Client) {
    setEditingId(c.id)
    setEditDraft({
      name: c.name,
      gender: c.gender,
      birthday: c.birthday?.slice(0, 10) ?? '2000-01-01',
      phone: c.phone ?? '',
      email: c.email ?? '',
      trainerId: c.trainerId ?? '',
      tariff: c.tariff ?? 'BASIC',
      membershipType: c.membership?.type ?? 'MONTHLY',
    })
    setRenewType(c.membership?.type ?? 'MONTHLY')
    setLoginEmail('')
    setLoginPassword('')
    setLoginDone(false)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Клиенты</h1>
          <p className="text-sm text-[var(--text-muted)]">Регистрация новых клиентов, редактирование и продление абонементов</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus size={14} /> Новый клиент
        </Button>
      </div>

      <Card>
        <SectionTitle title="Все клиенты" subtitle={`${list.length} из ${(clients ?? []).length} чел.`} />
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск по имени, телефону или email…"
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
          />
          <select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm">
            {(Object.keys(SORT_LABEL) as SortMode[]).map((m) => <option key={m} value={m}>{SORT_LABEL[m]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          {list.map((c) => {
            const trainer = (trainers ?? []).find((t) => t.id === c.trainerId)
            const tariffInfo = TARIFFS.find((t) => t.id === c.tariff)
            return (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={getInitials(c.name)} hue={c.avatarHue} size={34} />
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {c.phone ?? 'без телефона'} · {FORMAT_LABEL[c.format]}
                      {tariffInfo && ` · ${tariffInfo.name}`}
                      {trainer && ` · ${trainer.name}`}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.membership && (
                    <Badge tone={STATUS_TONE[c.membership.status]}>
                      {STATUS_LABEL[c.membership.status]}
                      {c.membership.expiresAt ? ` до ${c.membership.expiresAt.slice(0, 10)}` : ''}
                    </Badge>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
                    <UserCog size={13} /> Изменить
                  </Button>
                </div>
              </div>
            )
          })}
          {list.length === 0 && <EmptyState title="Никого не найдено" subtitle="Попробуйте другой запрос поиска" />}
        </div>
      </Card>

      <ClientOutreachList />

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Новый клиент">
        <div className="flex flex-col gap-3">
          <Field label="Имя Фамилия">
            <input value={createDraft.name} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Имя Фамилия"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Пол">
              <select value={createDraft.gender} onChange={(e) => setCreateDraft((d) => ({ ...d, gender: e.target.value as Gender }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
                <option value="F">Женский</option>
                <option value="M">Мужской</option>
              </select>
            </Field>
            <Field label="Дата рождения">
              <input type="date" value={createDraft.birthday} onChange={(e) => setCreateDraft((d) => ({ ...d, birthday: e.target.value }))}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Телефон">
              <input type="tel" value={createDraft.phone} onChange={(e) => setCreateDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+7 900 000-00-00"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
            <Field label="Email">
              <input type="email" value={createDraft.email} onChange={(e) => setCreateDraft((d) => ({ ...d, email: e.target.value }))} placeholder="client@mail.ru"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
            </Field>
          </div>
          <Field label="Тренер">
            <select value={createDraft.trainerId} onChange={(e) => setCreateDraft((d) => ({ ...d, trainerId: e.target.value }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
              <option value="">Самостоятельно, без тренера</option>
              {(trainers ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} · {t.specialization}</option>)}
            </select>
          </Field>
          <Field label="Тариф сопровождения">
            <select value={createDraft.tariff} onChange={(e) => setCreateDraft((d) => ({ ...d, tariff: e.target.value as Tariff }))} disabled={!createDraft.trainerId}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">
              {TARIFFS.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.price)} ₽/мес</option>)}
            </select>
            {!createDraft.trainerId && <span className="text-xs text-[var(--text-faint)]">Доступно после выбора тренера</span>}
          </Field>
          <Field label="Абонемент">
            <select value={createDraft.membershipType} onChange={(e) => setCreateDraft((d) => ({ ...d, membershipType: e.target.value as MembershipType }))}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
              {pricing && (Object.keys(MEMBERSHIP_LABEL) as MembershipType[]).map((m) => (
                <option key={m} value={m}>{MEMBERSHIP_LABEL[m]} — {formatMoney(pricing[m.toLowerCase() as 'single' | 'monthly' | 'pack10' | 'pack20'])} ₽</option>
              ))}
            </select>
          </Field>
          <Button onClick={submitCreate} disabled={!createDraft.name.trim() || createClient.isPending}>
            <Plus size={14} /> Создать клиента
          </Button>
        </div>
      </Modal>

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title={editingClient ? editingClient.name : 'Клиент'}>
        {editingClient && (
          <EditClientForm
            client={editingClient}
            draft={editDraft}
            setDraft={setEditDraft}
            trainers={trainers ?? []}
            pricing={pricing}
            renewType={renewType}
            setRenewType={setRenewType}
            onSaveProfile={(patch) => updateClient.mutate({ clientId: editingClient.id, data: patch })}
            onSaveTrainer={() => {
              if (!editDraft.trainerId) goSelfTraining.mutate()
              else if (editingClient.trainerId === editDraft.trainerId) changeTariff.mutate(editDraft.tariff)
              else chooseTrainer.mutate({ trainerId: editDraft.trainerId, tariff: editDraft.tariff })
            }}
            onRenew={() => purchaseMembership.mutate(renewType)}
            loginEmail={loginEmail}
            setLoginEmail={setLoginEmail}
            loginPassword={loginPassword}
            setLoginPassword={setLoginPassword}
            loginDone={loginDone}
            onCreateLogin={() => createLogin.mutate({ email: loginEmail, password: loginPassword }, { onSuccess: () => setLoginDone(true) })}
            loginPending={createLogin.isPending}
          />
        )}
      </Modal>
    </div>
  )
}

function EditClientForm({
  client, draft, setDraft, trainers, pricing, renewType, setRenewType, onSaveProfile, onSaveTrainer, onRenew,
  loginEmail, setLoginEmail, loginPassword, setLoginPassword, loginDone, onCreateLogin, loginPending,
}: {
  client: Client
  draft: ClientDraft
  setDraft: (fn: (d: ClientDraft) => ClientDraft) => void
  trainers: { id: string; name: string; specialization: string }[]
  pricing: ReturnType<typeof usePricing>['data']
  renewType: MembershipType
  setRenewType: (m: MembershipType) => void
  onSaveProfile: (patch: { name?: string; gender?: Gender; phone?: string; email?: string }) => void
  onSaveTrainer: () => void
  onRenew: () => void
  loginEmail: string
  setLoginEmail: (v: string) => void
  loginPassword: string
  setLoginPassword: (v: string) => void
  loginDone: boolean
  onCreateLogin: () => void
  loginPending: boolean
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Данные клиента</div>
        <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
        <div className="grid grid-cols-2 gap-2">
          <select value={draft.gender} onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value as Gender }))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
            <option value="F">Женский</option>
            <option value="M">Мужской</option>
          </select>
          <input type="date" value={draft.birthday} onChange={(e) => setDraft((d) => ({ ...d, birthday: e.target.value }))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="tel" value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="Телефон"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
          <input type="email" value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} placeholder="Email"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
        </div>
        <Button size="sm" variant="secondary" disabled={!draft.name.trim()} onClick={() => onSaveProfile({ name: draft.name.trim(), gender: draft.gender, phone: draft.phone.trim() || undefined, email: draft.email.trim() || undefined })}>
          Сохранить данные
        </Button>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Тренер и тариф</div>
        <select value={draft.trainerId} onChange={(e) => setDraft((d) => ({ ...d, trainerId: e.target.value }))}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
          <option value="">Самостоятельно, без тренера</option>
          {trainers.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.specialization}</option>)}
        </select>
        {draft.trainerId && (
          <select value={draft.tariff} onChange={(e) => setDraft((d) => ({ ...d, tariff: e.target.value as Tariff }))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
            {TARIFFS.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatMoney(t.price)} ₽/мес</option>)}
          </select>
        )}
        <Button size="sm" variant="secondary" onClick={onSaveTrainer}>Сохранить тренера и тариф</Button>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Абонемент</div>
        {client.membership && (
          <div className="text-sm text-[var(--text-muted)]">
            Сейчас: {MEMBERSHIP_LABEL[client.membership.type]} · <Badge tone={STATUS_TONE[client.membership.status]}>{STATUS_LABEL[client.membership.status]}</Badge>
            {client.membership.expiresAt && ` до ${client.membership.expiresAt.slice(0, 10)}`}
          </div>
        )}
        <select value={renewType} onChange={(e) => setRenewType(e.target.value as MembershipType)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
          {pricing && (Object.keys(MEMBERSHIP_LABEL) as MembershipType[]).map((m) => (
            <option key={m} value={m}>{MEMBERSHIP_LABEL[m]} — {formatMoney(pricing[m.toLowerCase() as 'single' | 'monthly' | 'pack10' | 'pack20'])} ₽</option>
          ))}
        </select>
        <Button size="sm" onClick={onRenew}><RefreshCcw size={13} /> Продлить / оформить абонемент</Button>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Доступ в приложение</div>
        {loginDone ? (
          <Badge tone="success">Доступ выдан ✓</Badge>
        ) : (
          <>
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="Email для входа"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            <input type="text" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} placeholder="Временный пароль (мин. 8 символов)"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm" />
            <Button size="sm" variant="secondary" disabled={!loginEmail.trim() || loginPassword.length < 8 || loginPending} onClick={onCreateLogin}>
              <UserPlus size={13} /> Выдать доступ
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
