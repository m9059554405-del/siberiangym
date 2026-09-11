import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { useFeedback, useSendFeedback } from '../hooks/useClientApi'
import { Button, Card, EmptyState } from './ui/Primitives'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function FeedbackThread({ clientId, viewer }: { clientId: string; viewer: 'client' | 'trainer' }) {
  const { data: messages } = useFeedback(clientId)
  const sendFeedback = useSendFeedback(clientId)
  const [text, setText] = useState('')

  const sorted = useMemo(() => [...(messages ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [messages])

  function submit() {
    if (!text.trim()) return
    sendFeedback.mutate(text.trim(), { onSuccess: () => setText('') })
  }

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">Обратная связь</h3>
      <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {sorted.length === 0 && <EmptyState title="Сообщений пока нет" />}
        {sorted.map((m) => {
          const mine = m.from === viewer
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${mine ? 'text-white' : 'bg-[var(--surface-sunken)] text-[var(--text)]'}`}
                style={mine ? { background: 'var(--accent-gradient)' } : undefined}
              >
                <p>{m.text}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-white/70' : 'text-[var(--text-faint)]'}`}>
                  {m.from === 'client' ? 'Клиент' : 'Тренер'} · {formatDateTime(m.date)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={viewer === 'client' ? 'Написать тренеру…' : 'Ответить клиенту…'}
          className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <Button size="sm" onClick={submit} disabled={!text.trim() || sendFeedback.isPending}>
          <Send size={14} />
        </Button>
      </div>
    </Card>
  )
}
