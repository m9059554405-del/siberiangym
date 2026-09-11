import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, Send } from 'lucide-react'
import { useCleaningChecklists, useToggleCleaningItem } from '../../hooks/useOpsApi'
import { useDirectorMessages, useReplyDirectorMessage } from '../../hooks/useCeoApi'
import { Badge, Button, Card, EmptyState, SectionTitle, Tabs } from '../../components/ui/Primitives'
import { Avatar } from '../../components/ui/Avatar'
import { EquipmentServiceList } from '../../components/EquipmentServiceList'
import { getInitials } from '../../lib/format'

const AREA_LABELS: Record<string, string> = {
  FLOOR: 'Пол', LIGHTING: 'Освещение', SURFACES: 'Поверхности', MIRRORS: 'Зеркала', RESTROOMS: 'Санузлы', LOCKERS: 'Шкафчики', WINDOWS: 'Окна',
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function MaintenancePage() {
  const { data: checklists } = useCleaningChecklists()
  const toggleItem = useToggleCleaningItem()
  const { data: messages } = useDirectorMessages()
  const replyMessage = useReplyDirectorMessage()
  const [tab, setTab] = useState<'equipment' | 'cleaning' | 'director'>('equipment')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const todayStr = todayIso()

  const sortedChecklists = useMemo(() => [...(checklists ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [checklists])
  const todayChecklist = sortedChecklists.find((c) => c.date.slice(0, 10) === todayStr)

  const sortedMessages = useMemo(() => [...(messages ?? [])].sort((a, b) => b.date.localeCompare(a.date)), [messages])

  function submitReply(messageId: string) {
    const text = replyDrafts[messageId]?.trim()
    if (!text) return
    replyMessage.mutate({ id: messageId, reply: text }, { onSuccess: () => setReplyDrafts((d) => ({ ...d, [messageId]: '' })) })
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Обслуживание клуба</h1>
        <p className="text-sm text-[var(--text-muted)]">Оборудование, клининг и обращения к директору</p>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'equipment', label: 'Оборудование' },
          { value: 'cleaning', label: 'Клининг' },
          { value: 'director', label: 'Обращения к директору' },
        ]}
      />

      {tab === 'equipment' && <EquipmentServiceList />}

      {tab === 'cleaning' && (
        <div className="flex flex-col gap-4">
          {todayChecklist && (
            <Card className="border-2 border-[var(--accent)]">
              <SectionTitle title="Сегодня" subtitle={`${todayChecklist.date.slice(0, 10)} · ответственный: ${todayChecklist.responsibleName}`} action={<Badge tone="accent">Текущий день</Badge>} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {todayChecklist.items.map((it) => (
                  <button
                    key={it.area}
                    onClick={() => toggleItem.mutate({ checklistId: todayChecklist.id, area: it.area })}
                    className={`tap-scale flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${it.done ? 'border-green-200 bg-green-50 text-green-700' : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}
                  >
                    {it.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                    {AREA_LABELS[it.area]}
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <SectionTitle title="История уборок" subtitle="Последние записи" />
            <div className="flex flex-col gap-2">
              {sortedChecklists.map((c) => {
                const doneCount = c.items.filter((it) => it.done).length
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
                    <div>
                      <span className="font-medium">{c.date.slice(0, 10)}</span>{' '}
                      <span className="text-xs text-[var(--text-faint)]">{c.responsibleName}</span>
                    </div>
                    <Badge tone={doneCount === c.items.length ? 'success' : doneCount === 0 ? 'danger' : 'warning'}>{doneCount}/{c.items.length} выполнено</Badge>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {tab === 'director' && (
        <div className="flex flex-col gap-3">
          {sortedMessages.length === 0 && <EmptyState title="Обращений пока нет" />}
          {sortedMessages.map((m) => (
            <Card key={m.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {m.client && <Avatar initials={getInitials(m.client.name)} hue={m.client.avatarHue} size={30} />}
                <div>
                  <div className="text-sm font-medium">{m.client?.name ?? '—'}</div>
                  <div className="text-[11px] text-[var(--text-faint)]">{m.date.slice(0, 16).replace('T', ', ')}</div>
                </div>
              </div>
              <p className="text-sm text-[var(--text)]">{m.text}</p>
              {m.reply ? (
                <div className="rounded-lg bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent-strong)]">
                  <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-80">Ответ директора</div>
                  {m.reply}
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={replyDrafts[m.id] ?? ''}
                    onChange={(e) => setReplyDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && submitReply(m.id)}
                    placeholder="Ответить клиенту…"
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
                  />
                  <Button size="sm" onClick={() => submitReply(m.id)} disabled={!replyDrafts[m.id]?.trim()}>
                    <Send size={13} />
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
