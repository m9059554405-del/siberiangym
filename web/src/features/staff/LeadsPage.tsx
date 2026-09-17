import { useMemo, useState } from 'react'
import { Check, UserPlus, X } from 'lucide-react'
import { useAllClients, useConvertLead, useCreateLead, useLeads, useUpdateLead } from '../../hooks/useStaffApi'
import { ApiError } from '../../lib/api'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import type { Lead, LeadStatus } from '../../types'

// P2.6: гостевые карточки (лиды) — воронка «пришёл узнать → попробовал →
// купил». Заводит карточку администратор на точке; визит и потеря
// отмечаются кнопками; конвертация привязывает лида к уже
// зарегистрированному клиенту (клиент создаётся обычной формой с
// абонементом — карточка лида лишь сохраняет историю воронки).
const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: 'Ждёт визита',
  VISITED: 'Пришёл',
  CONVERTED: 'Купил',
  LOST: 'Потерян',
}
const STATUS_TONE: Record<LeadStatus, 'accent' | 'success' | 'neutral' | 'danger'> = {
  NEW: 'accent',
  VISITED: 'success',
  CONVERTED: 'neutral',
  LOST: 'danger',
}
const FILTERS: Array<LeadStatus | 'ALL'> = ['ALL', 'NEW', 'VISITED', 'CONVERTED', 'LOST']

export function LeadsPage() {
  const { data: leads } = useLeads()
  const { data: clients } = useAllClients()
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  const convertLead = useConvertLead()

  const [filter, setFilter] = useState<LeadStatus | 'ALL'>('ALL')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [visitDate, setVisitDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [clientId, setClientId] = useState('')
  const [rowError, setRowError] = useState<string | null>(null)

  const list = useMemo(() => (leads ?? []).filter((l) => filter === 'ALL' || l.status === filter), [leads, filter])

  function submit() {
    if (name.trim().length < 2) {
      setFormError('Имя — минимум 2 символа')
      return
    }
    createLead.mutate(
      { name: name.trim(), phone: phone.trim() || undefined, visitDate, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setName('')
          setPhone('')
          setNote('')
          setFormError(null)
        },
        onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Не удалось создать карточку'),
      },
    )
  }

  function setStatus(lead: Lead, status: 'VISITED' | 'LOST') {
    setRowError(null)
    updateLead.mutate({ id: lead.id, status }, { onError: (err) => setRowError(err instanceof ApiError ? err.message : 'Не удалось обновить карточку') })
  }

  function convert(lead: Lead) {
    if (!clientId) {
      setRowError('Выберите клиента, которого зарегистрировали из этого лида')
      return
    }
    convertLead.mutate(
      { id: lead.id, clientId },
      {
        onSuccess: () => {
          setConvertingId(null)
          setClientId('')
          setRowError(null)
        },
        onError: (err) => setRowError(err instanceof ApiError ? err.message : 'Не удалось зафиксировать конвертацию'),
      },
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Гости и лиды</h1>
        <p className="text-sm text-[var(--text-muted)]">Воронка «пришёл узнать → попробовал → купил»: карточка гостя, визит, конвертация в клиента</p>
      </div>

      <Card>
        <SectionTitle title="Новая карточка гостя" subtitle="Дата визита по умолчанию — сегодня" />
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            placeholder="Имя гостя"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            placeholder="Телефон"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            type="date"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
          />
        </div>
        <input
          className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          placeholder="Комментарий (откуда пришёл, что интересует)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        {formError && <p className="mt-2 text-sm text-[var(--danger)]">{formError}</p>}
        <div className="mt-3">
          <Button size="sm" onClick={submit} disabled={createLead.isPending}>
            <span className="inline-flex items-center gap-1.5">
              <UserPlus size={14} />
              Завести гостя
            </span>
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === f ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]'}`}
          >
            {f === 'ALL' ? 'Все' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle title="Карточки гостей" subtitle={`${list.length} на этой точке`} />
        {rowError && <p className="mb-2 text-sm text-[var(--danger)]">{rowError}</p>}
        {list.length === 0 ? (
          <EmptyState title="Гостей пока нет" subtitle="Заведите первую карточку выше — например, по звонку из Instagram" />
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {list.map((l) => (
              <div key={l.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {l.name}
                      {l.phone ? <span className="ml-2 text-xs text-[var(--text-faint)]">{l.phone}</span> : null}
                    </p>
                    <p className="text-xs text-[var(--text-faint)]">
                      Визит: {l.visitDate?.slice(0, 10) ?? 'без даты'}
                      {l.note ? ` · ${l.note}` : ''}
                      {l.convertedClient ? ` · клиент: ${l.convertedClient.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
                    {l.status !== 'CONVERTED' && (
                      <>
                        {l.status !== 'VISITED' && (
                          <Button size="sm" variant="secondary" onClick={() => setStatus(l, 'VISITED')} disabled={updateLead.isPending}>
                            <span className="inline-flex items-center gap-1">
                              <Check size={14} />
                              Пришёл
                            </span>
                          </Button>
                        )}
                        {l.status !== 'LOST' && (
                          <Button size="sm" variant="secondary" onClick={() => setStatus(l, 'LOST')} disabled={updateLead.isPending}>
                            <span className="inline-flex items-center gap-1">
                              <X size={14} />
                              Потерян
                            </span>
                          </Button>
                        )}
                        <Button size="sm" onClick={() => { setConvertingId(convertingId === l.id ? null : l.id); setClientId(''); setRowError(null) }}>
                          Купил
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {convertingId === l.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-[var(--surface-sunken)] p-2">
                    <select
                      className="min-w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                    >
                      <option value="">— выберите клиента —</option>
                      {(clients ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" onClick={() => convert(l)} disabled={convertLead.isPending}>
                      Зафиксировать конвертацию
                    </Button>
                    <span className="text-xs text-[var(--text-faint)]">Клиента зарегистрируйте обычной формой «Клиенты» — здесь только связь</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
