import { useState, type PropsWithChildren } from 'react'
import { ChevronDown, ShieldCheck } from 'lucide-react'
import { useConsentTexts, useGrantConsent, useMyConsents } from '../hooks/useConsentsApi'
import { CLIENT_VISIBLE_CONSENT_TYPES } from '../lib/consentVisibility'
import { Button, Card } from './ui/Primitives'
import type { ConsentType } from '../types'

// Экран согласия при первом входе клиента (152-ФЗ, P0.4) — блокирует
// доступ к остальному приложению, пока не даны все обязательные согласия
// (`required: true` в ответе /consents/texts). Опциональные (маркетинг)
// показаны отдельными переключателями, не блокируют продолжение.
export function ConsentGate({ children }: PropsWithChildren) {
  const { data: texts } = useConsentTexts()
  const { data: statuses } = useMyConsents()
  const grant = useGrantConsent()

  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<ConsentType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!texts || !statuses) return null

  const missingRequired = statuses.filter((s) => s.required && !s.granted)
  if (missingRequired.length === 0) return <>{children}</>

  const optionalTypes = texts.texts.filter((t) => !t.required && CLIENT_VISIBLE_CONSENT_TYPES.includes(t.type)).map((t) => t.type)
  const allRequiredChecked = missingRequired.every((s) => checked[s.type])

  async function submit() {
    setSubmitting(true)
    try {
      const toGrant = [...missingRequired.map((s) => s.type), ...optionalTypes.filter((t) => checked[t])]
      for (const type of toGrant) {
        await grant.mutateAsync(type)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--surface)]">
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: 'var(--accent-gradient)' }}>
            <ShieldCheck size={20} />
          </div>
          <h1 className="text-lg font-bold">Прежде чем продолжить</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Нам нужно ваше согласие на обработку персональных данных (152-ФЗ) — без этого мы не сможем вести вашу карточку, замеры и
            записи на тренировки.
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {missingRequired.map((s) => {
            const text = texts.texts.find((t) => t.type === s.type)
            if (!text) return null
            return (
              <Card key={s.type} className="flex flex-col gap-2">
                <button onClick={() => setExpanded((v) => (v === s.type ? null : s.type))} className="flex items-center justify-between gap-2 text-left">
                  <span className="text-sm font-semibold">{text.title}</span>
                  <ChevronDown size={16} className={`shrink-0 text-[var(--text-faint)] transition-transform ${expanded === s.type ? 'rotate-180' : ''}`} />
                </button>
                {expanded === s.type && <p className="whitespace-pre-line text-xs text-[var(--text-muted)]">{text.body}</p>}
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!checked[s.type]}
                    onChange={(e) => setChecked((c) => ({ ...c, [s.type]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <span>Прочитал(а) и согласен(на)</span>
                </label>
              </Card>
            )
          })}

          {texts.texts
            .filter((t) => optionalTypes.includes(t.type))
            .map((t) => (
              <Card key={t.type} className="flex flex-col gap-2 bg-[var(--surface-sunken)]">
                <button onClick={() => setExpanded((v) => (v === t.type ? null : t.type))} className="flex items-center justify-between gap-2 text-left">
                  <span className="text-sm font-medium text-[var(--text-muted)]">{t.title} (необязательно)</span>
                  <ChevronDown size={16} className={`shrink-0 text-[var(--text-faint)] transition-transform ${expanded === t.type ? 'rotate-180' : ''}`} />
                </button>
                {expanded === t.type && <p className="whitespace-pre-line text-xs text-[var(--text-muted)]">{t.body}</p>}
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={!!checked[t.type]} onChange={(e) => setChecked((c) => ({ ...c, [t.type]: e.target.checked }))} className="mt-0.5" />
                  <span>Согласен(на)</span>
                </label>
              </Card>
            ))}
        </div>

        <Button onClick={submit} disabled={!allRequiredChecked || submitting}>
          Продолжить
        </Button>
        <p className="text-center text-[11px] text-[var(--text-faint)]">Версия текста: {texts.version}. Согласие можно отозвать в любой момент в разделе «Мои данные».</p>
      </div>
    </div>
  )
}
