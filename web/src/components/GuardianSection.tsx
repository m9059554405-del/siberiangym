import { useState } from 'react'
import { Check, UserPlus } from 'lucide-react'
import { useCreateGuardian, useGrantMinorConsent, useGuardiansForClient, useLinkGuardianChild, useSearchGuardians } from '../hooks/useGuardiansApi'
import { useClientConsents } from '../hooks/useConsentsApi'
import { Badge, Button } from './ui/Primitives'
import type { ConsentType } from '../types'

const MINOR_CONSENT_LABELS: Record<string, string> = {
  PDN_MINOR_GUARDIAN: '152-ФЗ (ПДн)',
  ACTIVITY_WAIVER_MINOR_GUARDIAN: 'Допуск к тренировкам',
}
const MINOR_CONSENT_TYPES: ConsentType[] = ['PDN_MINOR_GUARDIAN', 'ACTIVITY_WAIVER_MINOR_GUARDIAN']

// Показывается только для несовершеннолетних клиентов (P0.6) — поиск/
// создание/привязка законного представителя и фиксация его согласий.
// Пока у клиента нет ни одного представителя с обоими согласиями,
// оформить абонемент нельзя — это же правило проверяет сервер в
// orders.service (assertGuardianConsentsIfMinor), здесь только UI для того,
// чтобы это можно было исправить прямо в карточке.
export function GuardianSection({ clientId }: { clientId: string }) {
  const { data: guardians } = useGuardiansForClient(clientId)
  const { data: consents } = useClientConsents(clientId)
  const createGuardian = useCreateGuardian()
  const linkChild = useLinkGuardianChild()
  const grantConsent = useGrantMinorConsent()

  const [phone, setPhone] = useState('')
  const { data: found } = useSearchGuardians(phone)
  const [newOpen, setNewOpen] = useState(false)
  const [draft, setDraft] = useState({ fullName: '', phone: '', email: '', relation: 'родитель' })

  const consentByType = new Map((consents ?? []).map((c) => [c.type, c]))
  const linkedIds = new Set((guardians ?? []).map((g) => g.id))

  function submitNew() {
    if (!draft.fullName.trim() || !draft.phone.trim()) return
    createGuardian.mutate(
      { fullName: draft.fullName.trim(), phone: draft.phone.trim(), email: draft.email.trim() || undefined, relation: draft.relation.trim() || 'родитель' },
      {
        onSuccess: (g) => {
          linkChild.mutate({ guardianId: g.id, clientId })
          setDraft({ fullName: '', phone: '', email: '', relation: 'родитель' })
          setNewOpen(false)
          setPhone('')
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">Законные представители</div>

      {(guardians ?? []).length === 0 && (
        <div className="text-sm text-[var(--text-muted)]">
          Не привязан ни один законный представитель — оформить абонемент нельзя, пока не добавите хотя бы одного и не зафиксируете оба согласия.
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(guardians ?? []).map((g) => (
          <div key={g.id} className="rounded-lg bg-[var(--surface-sunken)] p-2.5">
            <div className="text-sm font-medium">
              {g.fullName} <span className="text-xs font-normal text-[var(--text-faint)]">· {g.relation}</span>
            </div>
            <div className="text-xs text-[var(--text-faint)]">{g.phone}{g.email ? ` · ${g.email}` : ''}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {MINOR_CONSENT_TYPES.map((type) => {
                const granted = consentByType.get(type)?.granted ?? false
                return granted ? (
                  <Badge key={type} tone="success">
                    <Check size={11} className="mr-1" /> {MINOR_CONSENT_LABELS[type]}
                  </Badge>
                ) : (
                  <Button
                    key={type}
                    size="sm"
                    variant="secondary"
                    disabled={grantConsent.isPending}
                    onClick={() => grantConsent.mutate({ guardianId: g.id, clientId, type })}
                  >
                    Зафиксировать: {MINOR_CONSENT_LABELS[type]}
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {!newOpen ? (
        <div className="flex flex-col gap-1.5">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Поиск представителя по телефону…"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          {phone.trim().length >= 3 && (
            <div className="flex flex-col gap-1">
              {(found ?? [])
                .filter((g) => !linkedIds.has(g.id))
                .map((g) => (
                  <button
                    key={g.id}
                    onClick={() => linkChild.mutate({ guardianId: g.id, clientId })}
                    disabled={linkChild.isPending}
                    className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1.5 text-left text-sm hover:bg-[var(--surface-raised)]"
                  >
                    <span>{g.fullName} · {g.phone}</span>
                    <span className="text-xs font-medium text-[var(--accent)]">Привязать</span>
                  </button>
                ))}
              {(found ?? []).filter((g) => !linkedIds.has(g.id)).length === 0 && (
                <div className="text-xs text-[var(--text-faint)]">Не найдено — можно создать нового ниже</div>
              )}
            </div>
          )}
          <Button size="sm" variant="secondary" onClick={() => setNewOpen(true)}>
            <UserPlus size={13} /> Новый представитель
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] p-2.5">
          <input
            value={draft.fullName}
            onChange={(e) => setDraft((d) => ({ ...d, fullName: e.target.value }))}
            placeholder="ФИО представителя"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder="Телефон"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm"
            />
            <input
              value={draft.relation}
              onChange={(e) => setDraft((d) => ({ ...d, relation: e.target.value }))}
              placeholder="Кем приходится"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm"
            />
          </div>
          <input
            value={draft.email}
            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            placeholder="Email (необязательно)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2 text-sm"
          />
          <div className="flex gap-1.5">
            <Button size="sm" disabled={!draft.fullName.trim() || !draft.phone.trim() || createGuardian.isPending} onClick={submitNew}>
              Создать и привязать
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setNewOpen(false)}>
              Отмена
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
