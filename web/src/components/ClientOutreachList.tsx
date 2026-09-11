import { useMemo, useState } from 'react'
import { Phone } from 'lucide-react'
import { useCreateOutreachNote, useOutreach } from '../hooks/useStaffApi'
import { Avatar } from './ui/Avatar'
import { Badge, Button, Card, EmptyState, SectionTitle } from './ui/Primitives'
import { Modal } from './ui/Modal'
import { getInitials } from '../lib/format'

type ExpiryFilter = 'all' | 'expired_any' | 'expired_1w' | 'expired_2w' | 'expired_4w' | 'expired_8w'

const FILTER_OPTIONS: { value: ExpiryFilter; label: string }[] = [
  { value: 'all', label: 'Все клиенты' },
  { value: 'expired_any', label: 'Абонемент истёк' },
  { value: 'expired_1w', label: 'Истёк более 1 недели назад' },
  { value: 'expired_2w', label: 'Истёк более 2 недель назад' },
  { value: 'expired_4w', label: 'Истёк более 4 недель назад' },
  { value: 'expired_8w', label: 'Истёк более 8 недель назад' },
]

function weeksSince(dateStr: string, todayStr: string): number {
  return Math.floor((new Date(todayStr).getTime() - new Date(dateStr).getTime()) / (7 * 86400000))
}
function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function ClientOutreachList({ canEdit = true }: { canEdit?: boolean }) {
  const { data: rows } = useOutreach()
  const createNote = useCreateOutreachNote()
  const [filter, setFilter] = useState<ExpiryFilter>('expired_4w')
  const [noteClientId, setNoteClientId] = useState<string | null>(null)
  const [called, setCalled] = useState(true)
  const [reason, setReason] = useState('')

  const todayStr = todayIso()

  const filtered = useMemo(() => {
    return (rows ?? [])
      .filter((c) => {
        if (filter === 'all') return true
        const expiresAt = c.membership?.expiresAt?.slice(0, 10)
        if (!expiresAt || expiresAt >= todayStr) return false
        const w = weeksSince(expiresAt, todayStr)
        if (filter === 'expired_any') return w >= 0
        if (filter === 'expired_1w') return w >= 1
        if (filter === 'expired_2w') return w >= 2
        if (filter === 'expired_4w') return w >= 4
        if (filter === 'expired_8w') return w >= 8
        return true
      })
      .sort((a, b) => (a.membership?.expiresAt ?? '').localeCompare(b.membership?.expiresAt ?? ''))
  }, [rows, filter, todayStr])

  const noteClient = (rows ?? []).find((c) => c.id === noteClientId)

  function openNote(clientId: string) {
    const existing = (rows ?? []).find((c) => c.id === clientId)?.latestOutreachNote
    setCalled(existing?.called ?? true)
    setReason(existing?.reason ?? '')
    setNoteClientId(clientId)
  }

  function submitNote() {
    if (!noteClientId) return
    createNote.mutate({ clientId: noteClientId, called, reason: reason.trim() }, { onSuccess: () => setNoteClientId(null) })
  }

  return (
    <Card>
      <SectionTitle
        title="Обзвон клиентов"
        subtitle={canEdit ? 'Фильтр по сроку окончания абонемента — кому пора позвонить и спросить, почему не ходит' : 'Фильтр по сроку окончания абонемента и результаты обзвона от администратора'}
      />
      <select value={filter} onChange={(e) => setFilter(e.target.value as ExpiryFilter)} className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-sm">
        {FILTER_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="flex flex-col gap-2">
        {filtered.map((c) => {
          const note = c.latestOutreachNote
          const expiresAt = c.membership?.expiresAt?.slice(0, 10)
          const w = expiresAt && expiresAt < todayStr ? weeksSince(expiresAt, todayStr) : null
          return (
            <div key={c.id} className="flex flex-col gap-1.5 rounded-lg bg-[var(--surface-sunken)] px-3 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Avatar initials={getInitials(c.name)} hue={c.avatarHue} size={34} />
                  <div>
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--text-faint)]">{c.phone ?? 'без телефона'}{c.email ? ` · ${c.email}` : ''}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {w !== null && <Badge tone={w >= 4 ? 'danger' : w >= 1 ? 'warning' : 'neutral'}>истёк {w} нед. назад</Badge>}
                  {note && <Badge tone={note.called ? 'success' : 'danger'}>{note.called ? 'звонили' : 'не дозвонились'}</Badge>}
                  {canEdit && (
                    <Button size="sm" variant="secondary" onClick={() => openNote(c.id)}>
                      <Phone size={13} /> {note ? 'Обновить' : 'Отметить звонок'}
                    </Button>
                  )}
                </div>
              </div>
              {note?.reason && (
                <div className="text-xs text-[var(--text-muted)]">Комментарий администратора ({note.authorName}): {note.reason}</div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <EmptyState title="Никого не найдено" subtitle="Под выбранный фильтр не попал ни один клиент" />}
      </div>

      {canEdit && (
        <Modal open={!!noteClientId} onClose={() => setNoteClientId(null)} title={noteClient ? `Обзвон: ${noteClient.name}` : 'Обзвон'}>
          {noteClient && (
            <div className="flex flex-col gap-3">
              <div className="text-sm text-[var(--text-muted)]">{noteClient.phone ?? 'Телефон не указан'}{noteClient.email ? ` · ${noteClient.email}` : ''}</div>
              <div className="flex gap-2">
                <Button size="sm" variant={called ? 'primary' : 'secondary'} onClick={() => setCalled(true)}>Дозвонились</Button>
                <Button size="sm" variant={!called ? 'primary' : 'secondary'} onClick={() => setCalled(false)}>Не дозвонились</Button>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Почему не ходит / комментарий…"
                rows={3}
                className="resize-none rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <Button onClick={submitNote} disabled={createNote.isPending}>Сохранить</Button>
            </div>
          )}
        </Modal>
      )}
    </Card>
  )
}
