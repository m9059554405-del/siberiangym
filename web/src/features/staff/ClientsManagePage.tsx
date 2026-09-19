import { useMemo, useState, type PropsWithChildren } from 'react'
import { Plus, RefreshCcw, Snowflake, UserCog, UserPlus } from 'lucide-react'
import { useGoSelfTraining, useTrainers } from '../../hooks/useClientApi'
import { useCreateCashOrder } from '../../hooks/useOrdersApi'
import { useClientConsents } from '../../hooks/useConsentsApi'
import { useAllClients, useCreateClient, useCreateClientLogin, useFreezeMembership, useNetworkClientSearch, useUnfreezeMembership, useUpdateClient, type CreateClientPayload } from '../../hooks/useStaffApi'
import { useNetworkGyms } from '../../hooks/useGymsApi'
import { TARIFFS, tariffPrice } from '../../data/tariffs'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { ClientOutreachList } from '../../components/ClientOutreachList'
import { OrderPendingNotice } from '../../components/OrderPendingNotice'
import { GuardianSection } from '../../components/GuardianSection'
import { formatMoney, getInitials } from '../../lib/format'
import { usePricing } from '../../hooks/useClientApi'
import { isLikelyMinor } from '../../lib/age'
import { ApiError } from '../../lib/api'
import type { Client, Gender, MembershipScope, MembershipType, Order, Tariff } from '../../types'

// Межточечный поиск (P1.5) — виден только если сеть реально состоит из
// нескольких точек, иначе не имеет смысла и только загромождает страницу.
function NetworkClientSearchSection() {
  const { data: networkGyms } = useNetworkGyms()
  const [query, setQuery] = useState('')
  const { data: results } = useNetworkClientSearch(query)

  if (!networkGyms || networkGyms.length <= 1) return null

  return (
    <Card>
      <SectionTitle title="Клиент с другой точки сети" subtitle="Если у клиента сетевой абонемент, его карточка может быть заведена не здесь" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Поиск по имени или телефону, по всей сети…"
        className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
      />
      {query.trim().length >= 2 && (
        <div className="flex flex-col gap-2">
          {(results ?? []).map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-[var(--text-faint)]">
                  {r.phone ?? 'без телефона'} · {r.isHomeGym ? 'эта точка' : r.gymName ?? 'другая точка'}
                  {r.membership && ` · ${MEMBERSHIP_LABEL[r.membership.type]}${r.membership.scope === 'NETWORK' ? ' (вся сеть)' : ''}`}
                </div>
              </div>
              <Badge tone={r.validHere ? 'success' : 'danger'}>{r.validHere ? 'Действует здесь' : 'Не действует здесь'}</Badge>
            </div>
          ))}
          {(results ?? []).length === 0 && <div className="text-xs text-[var(--text-faint)]">Никого не найдено</div>}
        </div>
      )}
    </Card>
  )
}

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

// Зеркало api/src/clients/membership.const.ts (FREEZE_LIMIT_DAYS): вебу
// нужно подсказать лимит до отправки запроса, API всё равно проверяет
// своё значение — источник правды там.
const FREEZE_LIMIT_DAYS: Record<MembershipType, number> = { SINGLE: 0, MONTHLY: 14, PACK10: 14, PACK20: 21 }

// Заморозка абонемента (P2.1) в карточке клиента: только для срочных
// типов (не разовое посещение) и только в статусах ACTIVE/FROZEN —
// истёкший сначала продлевается. Досрочная разморозка возвращает
// неизрасходованные дни и в срок, и в лимит (логика на API).
function MembershipFreezeSection({ client }: { client: Client }) {
  const m = client.membership
  const freeze = useFreezeMembership()
  const unfreeze = useUnfreezeMembership()
  const [days, setDays] = useState('7')
  const [error, setError] = useState<string | null>(null)

  if (!m || !m.expiresAt || FREEZE_LIMIT_DAYS[m.type] === 0) return null
  if (m.status === 'EXPIRED') return null

  const limit = FREEZE_LIMIT_DAYS[m.type]
  const remaining = Math.max(0, limit - m.frozenDaysUsed)
  const daysNum = Number(days)

  function submitFreeze() {
    setError(null)
    freeze.mutate(
      { clientId: client.id, days: daysNum },
      { onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось заморозить абонемент') },
    )
  }

  function submitUnfreeze() {
    setError(null)
    unfreeze.mutate(client.id, {
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось разморозить абонемент'),
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
      {error && <div className="text-xs text-red-600">{error}</div>}
      {m.status === 'FROZEN' ? (
        <>
          <div className="text-xs text-[var(--text-muted)]">
            Заморожен до {m.freezeEndsAt ? m.freezeEndsAt.slice(0, 10) : '—'} · использовано {m.frozenDaysUsed} из {limit} дн. лимита
          </div>
          <Button size="sm" variant="secondary" disabled={unfreeze.isPending} onClick={submitUnfreeze}>
            <Snowflake size={13} /> Разморозить досрочно
          </Button>
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={Math.min(30, remaining)}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <span className="text-xs text-[var(--text-faint)]">
              дней · лимит {limit} дн., доступно ещё {remaining}
            </span>
          </div>
          <Button size="sm" variant="secondary" disabled={remaining === 0 || freeze.isPending || !Number.isInteger(daysNum) || daysNum < 1} onClick={submitFreeze}>
            <Snowflake size={13} /> Заморозить
          </Button>
        </>
      )}
    </div>
  )
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
  const createCashOrder = useCreateCashOrder()

  const [createOpen, setCreateOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<ClientDraft>(EMPTY_DRAFT)

  const [editingId, setEditingId] = useState<string | null>(null)
  // clientId только на момент открытой карточки — до P0.6 здесь стоял
  // хардкод undefined, из-за чего кнопка "Самостоятельно" в карточке
  // клиента всегда отправляла запрос на несуществующего клиента и тихо
  // падала (ошибка нигде не отображалась, поэтому баг был незаметен).
  const goSelfTraining = useGoSelfTraining(editingId ?? undefined)
  const [editDraft, setEditDraft] = useState<ClientDraft>(EMPTY_DRAFT)
  const [renewType, setRenewType] = useState<MembershipType>('MONTHLY')
  const [renewScope, setRenewScope] = useState<MembershipScope>('SINGLE_GYM')
  // P4.4: промокод применяется к заказу абонемента/тарифа, вводится в
  // карточке клиента рядом с формой продления.
  const [renewPromo, setRenewPromo] = useState('')
  const [pendingOrder, setPendingOrder] = useState<Order | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)

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
    setRenewScope('SINGLE_GYM')
    setRenewPromo('')
    setLoginEmail('')
    setLoginPassword('')
    setLoginDone(false)
    setPendingOrder(null)
    setOrderError(null)
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

      <NetworkClientSearchSection />

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
              {TARIFFS.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatMoney(tariffPrice(t.id, pricing))} ₽/мес</option>)}
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
          {isLikelyMinor(createDraft.birthday) && !createDraft.trainerId && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              По дате рождения клиент несовершеннолетний — самостоятельные тренировки без тренера запрещены. Выберите тренера, чтобы продолжить.
              Законного представителя и его согласия нужно будет добавить сразу после создания карточки — без них нельзя будет оформить абонемент.
            </div>
          )}
          <Button
            onClick={submitCreate}
            disabled={!createDraft.name.trim() || createClient.isPending || (isLikelyMinor(createDraft.birthday) && !createDraft.trainerId)}
          >
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
            renewScope={renewScope}
            setRenewScope={setRenewScope}
            renewPromo={renewPromo}
            setRenewPromo={setRenewPromo}
            onSaveProfile={(patch) => updateClient.mutate({ clientId: editingClient.id, data: patch })}
            onSaveTrainer={() => {
              setOrderError(null)
              if (!editDraft.trainerId) {
                goSelfTraining.mutate(undefined, { onError: (err) => setOrderError(err instanceof ApiError ? err.message : 'Не удалось сохранить тренера') })
              } else {
                createCashOrder.mutate(
                  {
                    clientId: editingClient.id,
                    lines: [{ type: 'TARIFF_CHANGE', meta: { tariff: editDraft.tariff, trainerId: editDraft.trainerId } }],
                    promoCode: renewPromo.trim().toUpperCase() || undefined,
                  },
                  { onSuccess: setPendingOrder, onError: (err) => setOrderError(err instanceof ApiError ? err.message : 'Не удалось создать заказ') },
                )
              }
            }}
            onRenew={() => {
              setOrderError(null)
              createCashOrder.mutate(
                {
                  clientId: editingClient.id,
                  lines: [{ type: 'MEMBERSHIP_PURCHASE', meta: { membershipType: renewType, scope: renewScope } }],
                  promoCode: renewPromo.trim().toUpperCase() || undefined,
                },
                { onSuccess: setPendingOrder, onError: (err) => setOrderError(err instanceof ApiError ? err.message : 'Не удалось создать заказ') },
              )
            }}
            pendingOrder={pendingOrder}
            onDismissPendingOrder={() => setPendingOrder(null)}
            orderError={orderError}
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
  client, draft, setDraft, trainers, pricing, renewType, setRenewType, renewScope, setRenewScope, renewPromo, setRenewPromo, onSaveProfile, onSaveTrainer, onRenew,
  pendingOrder, onDismissPendingOrder, orderError,
  loginEmail, setLoginEmail, loginPassword, setLoginPassword, loginDone, onCreateLogin, loginPending,
}: {
  client: Client
  draft: ClientDraft
  setDraft: (fn: (d: ClientDraft) => ClientDraft) => void
  trainers: { id: string; name: string; specialization: string }[]
  pricing: ReturnType<typeof usePricing>['data']
  renewType: MembershipType
  setRenewType: (m: MembershipType) => void
  renewScope: MembershipScope
  setRenewScope: (s: MembershipScope) => void
  renewPromo: string
  setRenewPromo: (v: string) => void
  onSaveProfile: (patch: { name?: string; gender?: Gender; phone?: string; email?: string }) => void
  onSaveTrainer: () => void
  onRenew: () => void
  pendingOrder: Order | null
  onDismissPendingOrder: () => void
  orderError: string | null
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
      {pendingOrder && <OrderPendingNotice order={pendingOrder} onDismiss={onDismissPendingOrder} />}
      {orderError && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{orderError}</div>}
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
            {TARIFFS.map((t) => <option key={t.id} value={t.id}>{t.name} — {formatMoney(tariffPrice(t.id, pricing))} ₽/мес</option>)}
          </select>
        )}
        <Button size="sm" variant="secondary" onClick={onSaveTrainer}>Сохранить тренера и тариф</Button>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Абонемент</div>
        {client.membership && (
          <div className="text-sm text-[var(--text-muted)]">
            Сейчас: {MEMBERSHIP_LABEL[client.membership.type]}
            {client.membership.scope === 'NETWORK' && ' · вся сеть'} · <Badge tone={STATUS_TONE[client.membership.status]}>{STATUS_LABEL[client.membership.status]}</Badge>
            {client.membership.expiresAt && ` до ${client.membership.expiresAt.slice(0, 10)}`}
          </div>
        )}
        <MembershipFreezeSection client={client} />
        <input
          value={renewPromo}
          onChange={(e) => setRenewPromo(e.target.value.toUpperCase())}
          placeholder="Промокод (необязательно)"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-sm tracking-wide outline-none focus:border-[var(--accent)]"
        />
        <select value={renewType} onChange={(e) => setRenewType(e.target.value as MembershipType)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm">
          {pricing && (Object.keys(MEMBERSHIP_LABEL) as MembershipType[]).map((m) => (
            <option key={m} value={m}>{MEMBERSHIP_LABEL[m]} — {formatMoney(pricing[m.toLowerCase() as 'single' | 'monthly' | 'pack10' | 'pack20'])} ₽</option>
          ))}
        </select>
        {pricing && pricing[`${renewType.toLowerCase() as 'single' | 'monthly' | 'pack10' | 'pack20'}Network`] != null && (
          <label className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <input type="checkbox" checked={renewScope === 'NETWORK'} onChange={(e) => setRenewScope(e.target.checked ? 'NETWORK' : 'SINGLE_GYM')} />
            Оформить на всю сеть — {formatMoney(pricing[`${renewType.toLowerCase() as 'single' | 'monthly' | 'pack10' | 'pack20'}Network`]!)} ₽
          </label>
        )}
        <Button size="sm" onClick={onRenew}><RefreshCcw size={13} /> Продлить / оформить абонемент</Button>
      </div>

      {client.isMinor === true && <GuardianSection clientId={client.id} />}

      {client.isMinor !== true && <ConsentAuditSection clientId={client.id} />}

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

const AUDIT_LABELS: Record<string, string> = {
  PDN_ADULT: '152-ФЗ (ПДн)',
  HEALTH_DATA: 'Данные о здоровье',
  ACTIVITY_WAIVER_ADULT: 'Допуск к тренировкам',
}

// Read-only для CEO/STAFF — подтверждение, что клиент подписал нужные
// согласия до начала тренировок, без необходимости лезть в базу руками
// (P0.4). Само согласие даёт только клиент через личный кабинет.
function ConsentAuditSection({ clientId }: { clientId: string }) {
  const { data: statuses } = useClientConsents(clientId)
  if (!statuses) return null
  const relevant = statuses.filter((s) => s.type in AUDIT_LABELS)
  if (relevant.length === 0) return null

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Согласия (152-ФЗ)</div>
      <div className="flex flex-wrap gap-2">
        {relevant.map((s) => (
          <Badge key={s.type} tone={s.granted ? 'success' : 'danger'}>
            {AUDIT_LABELS[s.type]}: {s.granted ? 'подписано' : 'не подписано'}
          </Badge>
        ))}
      </div>
    </div>
  )
}
