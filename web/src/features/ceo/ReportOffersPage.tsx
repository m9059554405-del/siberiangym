import { useState } from 'react'
import { Megaphone, Plus, Power, Trash2 } from 'lucide-react'
import { useCreateReportOffer, useDeleteReportOffer, useReportOffers, useToggleReportOffer } from '../../hooks/useCeoApi'
import { Badge, Button, Card, EmptyState, SectionTitle } from '../../components/ui/Primitives'
import type { OfferAudience } from '../../types'

const AUDIENCE_LABELS: Record<OfferAudience, string> = {
  ALL: 'Всем клиентам',
  EXPIRING_SOON: 'Абонемент скоро истекает',
  TOP_PERFORMERS: 'Лидерам месяца',
}

export function ReportOffersPage() {
  const { data: offers } = useReportOffers()
  const createOffer = useCreateReportOffer()
  const toggleOffer = useToggleReportOffer()
  const deleteOffer = useDeleteReportOffer()

  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [audience, setAudience] = useState<OfferAudience>('ALL')

  const sorted = [...(offers ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  function submit() {
    if (!title.trim() || !text.trim()) return
    createOffer.mutate({ title: title.trim(), text: text.trim(), audience }, { onSuccess: () => { setTitle(''); setText(''); setAudience('ALL') } })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Предложения для рассылки</h1>
        <p className="text-sm text-[var(--text-muted)]">Персональные предложения по аудитории — подставляются клиентам, попадающим под условие.</p>
      </div>

      <Card>
        <SectionTitle title="Новое предложение" subtitle="Появится у клиентов, попадающих в выбранную аудиторию" />
        <div className="flex flex-col gap-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Заголовок (для себя)"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст предложения, который увидит клиент…" rows={3}
            className="resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          <div className="flex flex-wrap items-center gap-2">
            <select value={audience} onChange={(e) => setAudience(e.target.value as OfferAudience)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm">
              {(Object.keys(AUDIENCE_LABELS) as OfferAudience[]).map((a) => <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>)}
            </select>
            <Button size="sm" onClick={submit} disabled={!title.trim() || !text.trim() || createOffer.isPending}>
              <Plus size={14} /> Добавить
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Активные и архивные предложения" subtitle="Выключенные предложения не используются" />
        <div className="flex flex-col gap-2">
          {sorted.map((o) => (
            <div key={o.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
              <div className="flex items-start gap-2.5">
                <Megaphone size={16} className="mt-0.5 shrink-0 text-[var(--accent-strong)]" />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium">{o.title}</span>
                    <Badge tone="accent">{AUDIENCE_LABELS[o.audience]}</Badge>
                    <Badge tone={o.active ? 'success' : 'neutral'}>{o.active ? 'Активно' : 'Выключено'}</Badge>
                  </div>
                  <p className="mt-1 max-w-xl text-xs text-[var(--text-muted)]">{o.text}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => toggleOffer.mutate(o.id)}>
                  <Power size={13} /> {o.active ? 'Выключить' : 'Включить'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => deleteOffer.mutate(o.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
          {sorted.length === 0 && <EmptyState title="Предложений пока нет" subtitle="Добавьте первое выше" />}
        </div>
      </Card>
    </div>
  )
}
