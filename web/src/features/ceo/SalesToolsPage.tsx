import { useState } from 'react'
import { Building2, Gift, Plus, TicketPercent, Trash2 } from 'lucide-react'
import {
  useAddCorporateMember,
  useCorporateAccounts,
  useCorporateDetail,
  useCorporateStatement,
  useCreateCorporateAccount,
  useCreatePromoCode,
  useDeletePromoCode,
  usePromoCodes,
  useReferralSettings,
  useRemoveCorporateMember,
  useSetPromoCodeActive,
  useUpdateReferralSettings,
} from '../../hooks/useSalesApi'
import { useAllClients } from '../../hooks/useStaffApi'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import { Modal } from '../../components/ui/Modal'
import { formatMoney } from '../../lib/format'
import type { PromoCode } from '../../types'

const inputClass = 'rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'

// Инструменты продаж точки (P4.4): промокоды, реферальная программа и
// корпоративные договоры — стандартная механика продаж клуба, которой
// раньше не было ни в модели данных, ни в API.

function promoValue(p: PromoCode) {
  return p.percentOff != null ? `-${p.percentOff}%` : `−${formatMoney(p.amountOff ?? 0)} ₽`
}

function PromoCodesSection() {
  const { data: promos } = usePromoCodes()
  const create = useCreatePromoCode()
  const toggle = useSetPromoCodeActive()
  const remove = useDeletePromoCode()

  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState<'percent' | 'amount'>('percent')
  const [value, setValue] = useState('10')
  const [maxUses, setMaxUses] = useState('100')
  const [error, setError] = useState<string | null>(null)

  function submit() {
    const v = Number(value)
    if (!code.trim() || !Number.isFinite(v) || v <= 0) {
      setError('Укажите код и величину скидки')
      return
    }
    create.mutate(
      {
        code: code.trim(),
        title: title.trim() || undefined,
        ...(mode === 'percent' ? { percentOff: Math.floor(v) } : { amountOff: Math.floor(v) }),
        maxUses: Math.max(0, Number(maxUses) || 0),
      },
      {
        onSuccess: () => {
          setCode('')
          setTitle('')
          setError(null)
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Не удалось создать промокод'),
      },
    )
  }

  return (
    <section>
      <SectionTitle title="Промокоды" subtitle="Скидки на любой заказ: публичные акции и персональные бонусы" />
      <Card className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="КОД" className={inputClass} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Подпись (необязательно)" className={`${inputClass} col-span-2`} />
          <div className="flex gap-1">
            <select value={mode} onChange={(e) => setMode(e.target.value as 'percent' | 'amount')} className={inputClass}>
              <option value="percent">%</option>
              <option value="amount">₽</option>
            </select>
            <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" className={inputClass} />
          </div>
          <input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} inputMode="numeric" placeholder="Лимит, 0=∞" className={inputClass} />
        </div>
        <div className="flex items-center justify-between">
          {error ? <span className="text-xs text-red-600">{error}</span> : <span className="text-xs text-[var(--text-faint)]">Код уникален на точке; 0 в лимите — без ограничения применений</span>}
          <Button size="sm" onClick={submit} disabled={create.isPending}>
            <Plus size={13} /> Создать
          </Button>
        </div>
      </Card>
      <div className="mt-3 flex flex-col gap-2">
        {(promos ?? []).length === 0 && <EmptyState title="Промокодов пока нет" />}
        {(promos ?? []).map((p) => (
          <Card key={p.id} className="flex flex-wrap items-center gap-3">
            <TicketPercent size={16} className="text-[var(--accent-strong)]" />
            <span className="font-mono font-semibold tracking-wide">{p.code}</span>
            <span className="text-sm text-[var(--text-muted)]">{p.title ?? '—'}</span>
            <span className="text-sm font-medium text-[var(--accent-strong)]">{promoValue(p)}</span>
            <span className="text-xs text-[var(--text-faint)]">
              {p.usedCount}/{p.maxUses === 0 ? '∞' : p.maxUses} применений{p.clientId ? ' · персональный' : ''}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Активен' : 'Выключен'}</Badge>
              <Button size="sm" variant="secondary" onClick={() => toggle.mutate({ id: p.id, isActive: !p.isActive })}>
                {p.isActive ? 'Выключить' : 'Включить'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove.mutate(p.id)} disabled={(p._count?.orders ?? 0) > 0}>
                <Trash2 size={13} />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ReferralSection() {
  const { data: settings } = useReferralSettings()
  const update = useUpdateReferralSettings()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [referrer, setReferrer] = useState('')
  const [referred, setReferred] = useState('')

  if (!settings) return null
  const isEnabled = enabled ?? settings.enabled
  const referrerValue = referrer || String(settings.referrerPercent)
  const referredValue = referred || String(settings.referredPercent)

  return (
    <section>
      <SectionTitle title="Реферальная программа" subtitle="«Приведи друга»: обе стороны получают персональный промокод со скидкой" />
      <Card className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isEnabled} onChange={(e) => setEnabled(e.target.checked)} />
          Программа включена
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Скидка пригласившему, %
            <input value={referrerValue} onChange={(e) => setReferrer(e.target.value)} inputMode="numeric" className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-[var(--text-muted)]">
            Скидка приглашённому, %
            <input value={referredValue} onChange={(e) => setReferred(e.target.value)} inputMode="numeric" className={inputClass} />
          </label>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() =>
              update.mutate({
                enabled: isEnabled,
                referrerPercent: Math.max(0, Math.min(100, Number(referrerValue) || 0)),
                referredPercent: Math.max(0, Math.min(100, Number(referredValue) || 0)),
              })
            }
          >
            <Gift size={13} /> Сохранить
          </Button>
        </div>
      </Card>
    </section>
  )
}

// Список договоров не содержит участников — карточка тянет их отдельным
// запросом деталей (и ведомость) по открытому id.
function CorporateDetailModal({ accountId, onClose }: { accountId: string | null; onClose: () => void }) {
  const { data: clients } = useAllClients()
  const { data: account } = useCorporateDetail(accountId)
  const addMember = useAddCorporateMember()
  const removeMember = useRemoveCorporateMember()
  const { data: statement } = useCorporateStatement(accountId)
  const [clientId, setClientId] = useState('')
  const [error, setError] = useState<string | null>(null)

  const memberIds = new Set((account?.members ?? []).map((m) => m.clientId))

  return (
    <Modal open={!!accountId} onClose={onClose} title={account ? `«${account.name}» — корпоративный договор` : ''}>
      {account && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
            <Badge tone={account.isActive ? 'success' : 'neutral'}>{account.isActive ? 'Активен' : 'Деактивирован'}</Badge>
            <span>Скидка участникам: {account.discountPercent}%</span>
            {account.contactPerson && <span>Контакт: {account.contactPerson}{account.contactPhone ? ` · ${account.contactPhone}` : ''}</span>}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Сотрудники</div>
            {(account.members ?? []).length === 0 && <div className="text-sm text-[var(--text-muted)]">Пока никого</div>}
            {(account.members ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                <span>{m.client?.name ?? m.clientId}</span>
                <Button size="sm" variant="ghost" onClick={() => removeMember.mutate({ accountId: account.id, clientId: m.clientId })}>
                  Исключить
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputClass}>
                <option value="">Выберите клиента клуба…</option>
                {(clients ?? [])
                  .filter((c) => !memberIds.has(c.id))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
              </select>
              <Button
                size="sm"
                disabled={!clientId || addMember.isPending}
                onClick={() =>
                  addMember.mutate(
                    { accountId: account.id, clientId },
                    {
                      onSuccess: () => {
                        setClientId('')
                        setError(null)
                      },
                      onError: (err) => setError(err instanceof Error ? err.message : 'Не удалось добавить'),
                    },
                  )
                }
              >
                <Plus size={13} /> Добавить
              </Button>
            </div>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Ведомость (оплаченные заказы)</div>
            {statement && (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold">{formatMoney(statement.totalRub)} ₽</span>
                  <span className="text-[var(--text-muted)]">за {statement.count} заказ(ов)</span>
                </div>
                {statement.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                    <span>{o.clientName}</span>
                    <span className="text-xs text-[var(--text-faint)]">{o.paidAt?.slice(0, 10)}</span>
                    <span className="font-medium">{formatMoney(o.totalAmount)} ₽{o.discount ? <span className="text-[var(--text-faint)]"> (−{formatMoney(o.discount)})</span> : null}</span>
                  </div>
                ))}
                {statement.orders.length === 0 && <div className="text-sm text-[var(--text-muted)]">Оплаченных заказов пока нет</div>}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

function CorporateSection() {
  const { data: accounts } = useCorporateAccounts()
  const create = useCreateCorporateAccount()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [discount, setDiscount] = useState('10')
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  function submit() {
    if (!name.trim()) return
    create.mutate(
      { name: name.trim(), contactPerson: contact.trim() || undefined, discountPercent: Math.max(0, Math.min(100, Number(discount) || 0)) },
      {
        onSuccess: () => {
          setName('')
          setContact('')
          setError(null)
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Не удалось создать договор'),
      },
    )
  }

  return (
    <section>
      <SectionTitle title="Корпоративные договоры" subtitle="Сотрудники компаний-партнёров — скидка и сводная ведомость для бухгалтерии" />
      <Card className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название компании" className={inputClass} />
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Контактное лицо" className={inputClass} />
          <input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="numeric" placeholder="Скидка, %" className={inputClass} />
          <Button size="sm" onClick={submit} disabled={!name.trim() || create.isPending}>
            <Plus size={13} /> Заключить
          </Button>
        </div>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </Card>
      <div className="mt-3 flex flex-col gap-2">
        {(accounts ?? []).length === 0 && <EmptyState title="Договоров пока нет" />}
        {(accounts ?? []).map((a) => (
          <Card key={a.id} className="flex cursor-pointer flex-wrap items-center gap-3" >
            <Building2 size={16} className="text-[var(--accent-strong)]" />
            <span className="font-semibold">{a.name}</span>
            <Badge tone={a.isActive ? 'success' : 'neutral'}>{a.isActive ? 'Активен' : 'Деактивирован'}</Badge>
            <span className="text-sm text-[var(--text-muted)]">скидка {a.discountPercent}%</span>
            <span className="text-xs text-[var(--text-faint)]">{a._count?.members ?? 0} сотр. · {a._count?.orders ?? 0} заказ(ов)</span>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setOpenId(a.id)}>
              Открыть
            </Button>
          </Card>
        ))}
      </div>
      <CorporateDetailModal accountId={openId} onClose={() => setOpenId(null)} />
    </section>
  )
}

export function SalesToolsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Продажи</h1>
        <p className="text-sm text-[var(--text-muted)]">Промокоды, реферальная программа и корпоративные абонементы точки</p>
      </div>
      <PromoCodesSection />
      <ReferralSection />
      <CorporateSection />
    </div>
  )
}
