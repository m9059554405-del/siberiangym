import { useMemo, useState } from 'react'
import { CheckCircle2, Circle, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useCleaningChecklists, useCleaningZones, useCreateCleaningZone, useDeleteCleaningZone, useToggleCleaningItem, useUpdateCleaningZone } from '../../hooks/useOpsApi'
import { useDirectorMessages, useReplyDirectorMessage } from '../../hooks/useCeoApi'
import { Badge, Button, Card, EmptyState, SectionTitle, Tabs } from '../../components/ui/Primitives'
import { Avatar } from '../../components/ui/Avatar'
import { EquipmentServiceList } from '../../components/EquipmentServiceList'
import { ApiError } from '../../lib/api'
import { getInitials } from '../../lib/format'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Управление зонами уборки точки (P4.2) — настройка под конкретный зал:
// добавить, переименовать, убрать неиспользуемую. Зона с историей
// чек-листов не удаляется (история должна сохраниться) — можно переименовать.
function CleaningZonesEditor() {
  const { data: zones } = useCleaningZones()
  const createZone = useCreateCleaningZone()
  const updateZone = useUpdateCleaningZone()
  const deleteZone = useDeleteCleaningZone()
  const [name, setName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submitCreate() {
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    setError(null)
    createZone.mutate({ name: trimmed }, {
      onSuccess: () => setName(''),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось добавить зону'),
    })
  }

  function submitRename(id: string) {
    const trimmed = renameDraft.trim()
    if (trimmed.length < 2) return
    setError(null)
    updateZone.mutate({ id, name: trimmed }, {
      onSuccess: () => setRenamingId(null),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'Не удалось переименовать зону'),
    })
  }

  function remove(id: string, zoneName: string) {
    setError(null)
    deleteZone.mutate(id, {
      onError: (err) => setError(err instanceof ApiError ? err.message : `Не удалось удалить зону «${zoneName}»`),
    })
  }

  return (
    <Card>
      <SectionTitle title="Зоны уборки точки" subtitle="Настраиваются под этот зал (P4.2): чек-листы создаются из текущего списка зон" />
      {error && <div className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="flex flex-col gap-1.5">
        {(zones ?? []).map((z) => (
          <div key={z.id} className="flex items-center gap-2 rounded-lg bg-[var(--surface-sunken)] px-3 py-2 text-sm">
            {renamingId === z.id ? (
              <>
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(z.id); if (e.key === 'Escape') setRenamingId(null) }}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
                />
                <Button size="sm" onClick={() => submitRename(z.id)} disabled={updateZone.isPending}>Сохранить</Button>
                <Button size="sm" variant="secondary" onClick={() => setRenamingId(null)}>Отмена</Button>
              </>
            ) : (
              <>
                <span className="flex-1">{z.name}</span>
                <Button size="sm" variant="secondary" title="Переименовать" onClick={() => { setRenamingId(z.id); setRenameDraft(z.name) }}>
                  <Pencil size={13} />
                </Button>
                <Button size="sm" variant="danger" title="Удалить неиспользуемую зону" onClick={() => remove(z.id, z.name)} disabled={deleteZone.isPending}>
                  <Trash2 size={13} />
                </Button>
              </>
            )}
          </div>
        ))}
        {(zones ?? []).length === 0 && (
          <p className="text-sm text-[var(--text-faint)]">Зон нет — чек-листы не смогут создаться. Добавьте хотя бы одну.</p>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submitCreate()}
          placeholder="Новая зона (например, «Бассейн»)"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
        />
        <Button size="sm" onClick={submitCreate} disabled={name.trim().length < 2 || createZone.isPending}>
          <Plus size={13} /> Добавить
        </Button>
      </div>
    </Card>
  )
}

export function MaintenancePage() {
  const { data: checklists } = useCleaningChecklists()
  const { data: zones } = useCleaningZones()
  const zoneName = useMemo(() => new Map((zones ?? []).map((z) => [z.id, z.name])), [zones])
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
          <CleaningZonesEditor />

          {todayChecklist && (
            <Card className="border-2 border-[var(--accent)]">
              <SectionTitle title="Сегодня" subtitle={`${todayChecklist.date.slice(0, 10)} · ответственный: ${todayChecklist.responsibleName}`} action={<Badge tone="accent">Текущий день</Badge>} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {todayChecklist.items.map((it) => (
                  <button
                    key={it.zoneId}
                    onClick={() => toggleItem.mutate({ checklistId: todayChecklist.id, zoneId: it.zoneId })}
                    className={`tap-scale flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${it.done ? 'border-green-200 bg-green-50 text-green-700' : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]'}`}
                  >
                    {it.done ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                    {it.zone?.name ?? zoneName.get(it.zoneId) ?? '—'}
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
